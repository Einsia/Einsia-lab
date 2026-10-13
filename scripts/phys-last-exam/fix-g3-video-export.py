"""Pad odd half-resolution P3 overlays for yuv420p; reuse validated track cache."""
import argparse,concurrent.futures,hashlib,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public'
p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--source',type=Path,required=True);a=p.parse_args()
module=a.package/'g3/P3/evaluator/evaluate_raw_legacy.py';s=module.read_text()
if 'encoded_w' not in s:
 s=s.replace('stream.width, stream.height = out_w, out_h','encoded_w, encoded_h = out_w + out_w % 2, out_h + out_h % 2\n    stream.width, stream.height = encoded_w, encoded_h')
 s=s.replace('frame = av.VideoFrame.from_ndarray(image, format="bgr24")','image = cv2.copyMakeBorder(image, 0, encoded_h-out_h, 0, encoded_w-out_w, cv2.BORDER_CONSTANT)\n        frame = av.VideoFrame.from_ndarray(image, format="bgr24")')
 module.write_text(s)
manifest=PUBLIC/'phys-last-exam'/a.source.name/'adapted-catalogue.json';gallery=json.loads(manifest.read_text())
def run(e):
 folder=(PUBLIC/e['original'].lstrip('/')).parent/'debug-adapted';log=folder/'export-repair.log'
 cmd=[sys.executable,str(Path(__file__).with_name('extract-task.py')),'--package',str(a.package),'--task','P3','--video',str(a.source/e['source']),'--output',str(folder/'measurements.json'),'--model',e['model'],'--seed',str(e['seed']),'--localization']
 env={**os.environ,'CUDA_VISIBLE_DEVICES':'0','OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','HF_HUB_OFFLINE':'1'}
 with log.open('w') as f:r=subprocess.run(cmd,stdout=f,stderr=f,env=env,timeout=240)
 assert r.returncode==0,log
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(folder/'overlay.mp4'),'-an','-vf','scale=960:-2','-c:v','libx264','-threads','1','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(folder/'annotated.mp4')],check=True)
 url='/'+str(folder.relative_to(PUBLIC));e.update(annotated=url+'/annotated.mp4',annotationKind='native_overlay',reason='',log=url+'/export-repair.log')
 e['adaptation']['exportRepair']={'moduleSha256':hashlib.sha256(module.read_bytes()).hexdigest(),'change':'Pad odd overlay dimensions by one pixel; same measured trajectories and scale.'}
 (folder/'entry.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n');return e
failed=[e for e in gallery['entries'] if e['task']=='P3' and not e['annotated']]
with concurrent.futures.ThreadPoolExecutor(4) as pool:
 for e in pool.map(run,failed):print('Repaired',e['model'],e['task'],e['seed'])
gallery['coverage']['annotated']=sum(bool(e['annotated']) for e in gallery['entries'])
from collections import Counter
gallery['coverage']['annotationKinds']=dict(Counter(e.get('annotationKind') or 'none' for e in gallery['entries']))
manifest.write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n')
