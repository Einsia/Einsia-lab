"""Re-encode delivered evaluator overlay videos (annotated.mp4) in place.

The overlays used to ship as the evaluator's own bytes, roughly 4x the size of
the 640 px original web copies. This re-encodes them once as H.264 at most
960 px wide (CRF 30), keeps the evaluator output hash as provenance, and
refreshes video-gallery.json and release-assets.json. It is idempotent:
entries already marked `annotationReencoded` are skipped. Run it after any
step that installs new evaluator overlays into public/phys-last-exam.

Requires ffmpeg locally (pass --ffmpeg if it is not on PATH). Only files under
public/phys-last-exam are read or written.
"""
import argparse, concurrent.futures, hashlib, json, re, subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/'public/phys-last-exam'
# Keep in sync with ANNOTATION_ENCODING in prepare-web-release.py.
ENCODING={'codec':'libx264','preset':'slow','crf':30,'maxWidth':960,'version':1}
SUMMARY='Evaluator overlay videos re-encoded for delivery: H.264, maximum width 960px, CRF 30; delivery.annotatedSourceSha256 retains the evaluator output hash'

def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def write(p,data):
    p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
def local(url):
    assert url.startswith('/phys-last-exam/') and '..' not in Path(url).parts,url
    return SITE/url[len('/phys-last-exam/'):]
def frames(ffmpeg,p):
    out=subprocess.run([ffmpeg,'-v','error','-stats','-i',str(p),'-map','0:v:0','-c','copy','-f','null','-'],check=True,capture_output=True,text=True).stderr
    found=re.findall(r'frame=\s*(\d+)',out);assert found,f'Could not count frames: {p}'
    return int(found[-1])

def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--ffmpeg',default='ffmpeg')
    a.add_argument('--workers',type=int,default=6)
    args=a.parse_args()
    gallery_path=SITE/'video-gallery.json';manifest_path=SITE/'release-assets.json'
    gallery=json.loads(gallery_path.read_text(encoding='utf-8'))
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    expected={x['url']:x for x in manifest['assets']}
    todo=[e for e in gallery['entries'] if e.get('annotated') and not e['delivery'].get('annotationReencoded') and not e['delivery'].get('annotationEncodingSkipped')]
    print(f'{len(todo)} overlay videos to re-encode',flush=True)

    def encode(e):
        src=local(e['annotated']);source_sha=sha(src)
        assert source_sha==expected[e['annotated']]['sha256'],f'Overlay does not match release manifest: {src}'
        tmp=src.with_name('annotated.tmp.mp4')
        subprocess.run([args.ffmpeg,'-v','error','-y','-i',str(src),'-map','0:v:0','-an','-vf',f'scale=min({ENCODING["maxWidth"]}\\,iw):-2',
                        '-c:v',ENCODING['codec'],'-threads','2','-preset',ENCODING['preset'],'-crf',str(ENCODING['crf']),
                        '-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)],check=True,capture_output=True)
        assert frames(args.ffmpeg,tmp)==frames(args.ffmpeg,src),f'Frame count changed: {src}'
        before=src.stat().st_size;after=tmp.stat().st_size
        if after>=before:
            tmp.unlink();return e,source_sha,None,before,before
        tmp.replace(src);return e,source_sha,sha(src),before,after

    before_total=after_total=skipped=0
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        for i,(e,source_sha,new_sha,before,after) in enumerate(pool.map(encode,todo),1):
            d=e['delivery'];d['annotatedSourceSha256']=source_sha
            if new_sha:
                d.update(annotationReencoded=True,annotatedSha256=new_sha,annotationEncoding=ENCODING)
            else:
                d.update(annotationReencoded=False,annotationEncodingSkipped=True);skipped+=1
            before_total+=before;after_total+=after
            if i%100==0:print(f'{i}/{len(todo)}  {before_total/1e6:.1f} MB -> {after_total/1e6:.1f} MB',flush=True)
    gallery['delivery']['annotations']=SUMMARY
    write(gallery_path,gallery)

    # Refresh the integrity inventory only for files this release step may change.
    changed=[]
    for x in manifest['assets']:
        p=local(x['url']);n=p.stat().st_size
        if n!=x['bytes'] or sha(p)!=x['sha256']:
            assert x['url'].endswith('/annotated.mp4') or x['url'] in ('/phys-last-exam/video-gallery.json','/phys-last-exam/README.md'),f'Unexpected change outside overlays: {x["url"]}'
            x['bytes']=n;x['sha256']=sha(p);changed.append(x['url'])
    manifest['bytes']=sum(x['bytes'] for x in manifest['assets'])
    manifest['generatedAt']=datetime.now(timezone.utc).isoformat()
    write(manifest_path,manifest)
    print(f'Re-encoded {len(todo)-skipped}, kept {skipped} (no smaller); overlays {before_total/1e6:.1f} MB -> {after_total/1e6:.1f} MB; '
          f'{len(changed)} manifest entries refreshed; release now {manifest["bytes"]/1e6:.1f} MB',flush=True)

if __name__=='__main__':main()
