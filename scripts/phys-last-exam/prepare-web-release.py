"""Build a self-contained Pages snapshot; keep evaluation originals outside public.

Requires ffmpeg/ffprobe and Pillow locally. CI only validates the committed
snapshot and builds Astro; it never needs the source dataset or model weights.
"""
import argparse, concurrent.futures, hashlib, json, shutil, subprocess
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
LOCAL=ROOT/'.local/phys-last-exam'
def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def write(p,data):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
def install(stage):
    current=ROOT/'public/phys-last-exam';archive=LOCAL/'source-public/phys-last-exam'
    assert json.loads((stage/'video-gallery.json').read_text()).get('delivery')
    if current.exists():
        existing=json.loads((current/'video-gallery.json').read_text())
        if not existing.get('delivery'):
            assert not archive.exists(),'Archive already exists; refusing to overwrite it'
            archive.parent.mkdir(parents=True,exist_ok=True);current.rename(archive)
        else:
            previous=LOCAL/('previous-release-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S'))
            current.rename(previous)
    stage.rename(current)
    print('Installed public/phys-last-exam; complete evaluation assets retained under .local/phys-last-exam/source-public/phys-last-exam')
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-public',type=Path,required=True)
    p.add_argument('--workers',type=int,default=8)
    p.add_argument('--install',action='store_true',help='Archive old public/phys-last-exam and install the staged snapshot')
    p.add_argument('--install-only',action='store_true',help='Install an already prepared and validated staging directory')
    args=p.parse_args();source=args.source_public.resolve();stage=LOCAL/'release-public/phys-last-exam'
    if args.install_only:
        install(stage);return
    stage.mkdir(parents=True,exist_ok=True)
    g=json.loads((source/'phys-last-exam/video-gallery.json').read_text())
    assert not g.get('delivery'),'Use the full evaluation catalogue as input, not an already compressed release'
    for name in ['benchmark.json','tasks','difficulty.webp','paper-draft.pdf','paper-results.json','logos','paper-overview.webp','teaser.pdf']:
        src=source/'phys-last-exam'/name;dst=stage/name
        if name in ['paper-draft.pdf','paper-results.json','logos','paper-overview.webp','teaser.pdf'] and (ROOT/'public/phys-last-exam'/name).exists():
            src=ROOT/'public/phys-last-exam'/name
        if src.is_dir():shutil.copytree(src,dst,dirs_exist_ok=True)
        elif src.is_file():shutil.copy2(src,dst)
    def path(url):
        assert url.startswith('/phys-last-exam/') and '..' not in Path(url).parts
        return source/url.lstrip('/')
    def entry(old):
        ident=f'{old["model"]}/{old["task"]}/{old["seed"]}'
        dest=stage/'videos'/ident;dest.mkdir(parents=True,exist_ok=True)
        evidence=stage/'evidence'/ident;evidence.mkdir(parents=True,exist_ok=True)
        keep=['model','task','seed','source','sourceSha256','codeSha256','duration','sourceFrames','availableMetrics','definedMetrics','status','annotationKind','reason']
        e={k:old[k] for k in keep if k in old}
        original=path(old['original']);assert sha(original)==old['sourceSha256']
        target=dest/'original.mp4';stamp=LOCAL/'encode-cache'/ident/'original.json'
        encoding={'sourceSha256':sha(original),'maxWidth':640,'crf':26,'preset':'slow','codec':'libx264','version':1}
        cache=json.loads(stamp.read_text()) if stamp.exists() else {}
        if not target.exists() or cache.get('encoding')!=encoding or cache.get('sha256')!=sha(target):
            tmp=target.with_name('original.tmp.mp4')
            command=['ffmpeg','-v','error','-y','-i',str(original),'-map','0:v:0','-an','-vf','scale=min(640\\,iw):-2','-c:v','libx264','-threads','2','-preset','slow','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)]
            subprocess.run(command,check=True,capture_output=True);tmp.replace(target)
            write(stamp,{'encoding':encoding,'sha256':sha(target)})
        e['original']='/phys-last-exam/videos/'+ident+'/original.mp4'
        e['delivery']={'originalIsWebCopy':True,'originalSourceSha256':old['sourceSha256'],'originalSha256':sha(target),'maxWidth':640,'annotationReencoded':False}
        e['annotated']=None
        if old.get('annotated'):
            shutil.copy2(path(old['annotated']),dest/'annotated.mp4')
            e['annotated']='/phys-last-exam/videos/'+ident+'/annotated.mp4'
        for key in ['poster','figure']:
            e[key]=None
            if old.get(key):
                with Image.open(path(old[key])) as im:
                    im=im.convert('RGB');im.thumbnail((1600,1600));im.save(evidence/(key+'.webp'),'WEBP',quality=85,method=6)
                e[key]='/phys-last-exam/evidence/'+ident+'/'+key+'.webp'
        for key in ['measurement','visualizationMeasurement','features','frames']:
            e[key]=None
            if old.get(key):
                # Preserve values, compact whitespace only. Workstation paths in
                # evidence are historical provenance, never browser dependencies.
                write(evidence/(key+'.json'),json.loads(path(old[key]).read_text()))
                e[key]='/phys-last-exam/evidence/'+ident+'/'+key+'.json'
        e['log']=None # verbose backend logs belong to the local working archive
        if old.get('initializationRun'):
            run=old['initializationRun'];ann=json.loads(path(run['annotation']).read_text())
            assert sha(path(run['frameZero']))==ann['source_image_sha256']
            shutil.copy2(path(run['annotation']),evidence/'initialization.json')
            shutil.copy2(path(run['frameZero']),evidence/'frame-zero.png')
            e['initializationRun']={k:run[k] for k in ['signature','measurementRecomputed','historicalLeaderboardChanged']}
            e['initializationRun'].update(annotation='/phys-last-exam/evidence/'+ident+'/initialization.json',frameZero='/phys-last-exam/evidence/'+ident+'/frame-zero.png')
        return e
    entries=[]
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        for i,e in enumerate(pool.map(entry,g['entries']),1):
            entries.append(e)
            if i%100==0:print(f'{i}/{len(g["entries"])}',flush=True)
    release={k:g[k] for k in ['generatedAt','source','coverage']}
    release.update(package='vdmbench2/vdmbench/v3',mode='web-release',entries=entries,
                   delivery={'version':1,'originals':'H.264 web copies, maximum width 640px; source SHA-256 retained for evaluation provenance','annotations':'Existing evaluator overlay bytes, unchanged','historicalLeaderboardChanged':False})
    write(stage/'video-gallery.json',release)
    for name in ['initialization-rerun-summary.json','adapted-weight-provenance.json']:
        src=source/'phys-last-exam/all_test'/name
        if src.exists():shutil.copy2(src,stage/name)
    readme=ROOT/'scripts/phys-last-exam/WEB_RELEASE.md'
    if readme.exists():shutil.copy2(readme,stage/'README.md')
    assets=[]
    for f in sorted(stage.rglob('*')):
        if f.is_file() and f.name!='release-assets.json':
            assert not f.is_symlink()
            assets.append({'url':'/phys-last-exam/'+str(f.relative_to(stage)),'bytes':f.stat().st_size,'sha256':sha(f)})
    total=sum(x['bytes'] for x in assets)
    assert total<900_000_000,f'World Models’ Last Exam in Physics release exceeds 900 MB budget: {total}'
    write(stage/'release-assets.json',{'version':1,'generatedAt':datetime.now(timezone.utc).isoformat(),'bytes':total,'assets':assets})
    print('Prepared',len(entries),'samples;',total,'bytes;',len(assets),'files',flush=True)
    if args.install:
        install(stage)

if __name__=='__main__':main()
