"""Regenerate native localization media without replacing the active catalogue."""
import argparse, concurrent.futures, hashlib, json, os, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public'
p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--source',type=Path,required=True);p.add_argument('--workers',type=int,default=6);p.add_argument('--pilot',action='store_true');p.add_argument('--task');a=p.parse_args()
gallery=json.loads((PUBLIC/'phys-last-exam/video-gallery.json').read_text());tasks={'P1','P2','P5','P8a','P8b','P14','P16','P18','P20','P21','P45','P48','P7','P8c','P10','P12','P27'}
entries=[e for e in gallery['entries'] if e['task'] in tasks and (not a.task or e['task']==a.task)]
if a.pilot:
 first={}
 for e in entries:first.setdefault(e['task'],e)
 entries=list(first.values())
codehash=hashlib.sha256(b''.join(p.read_bytes() for p in sorted(a.package.rglob('*.py')))+Path(__file__).read_bytes()+Path(__file__).with_name('extract-task.py').read_bytes()).hexdigest()
def run(e):
 assert hashlib.sha256((a.source/e['source']).read_bytes()).hexdigest()==e['sourceSha256'], 'Source changed since catalogue export'
 directory=(PUBLIC/e['original'].lstrip('/')).parent/'debug-localization';directory.mkdir(exist_ok=True)
 provenance=directory/'provenance.json'
 if provenance.exists():
  prev=json.loads(provenance.read_text())
  if prev['codeSha256']==codehash and prev['sourceSha256']==e['sourceSha256'] and (directory/'localization.mp4').exists():return f'{e["model"]}/{e["task"]}/{e["seed"]}: cached'
 cmd=[sys.executable,str(Path(__file__).with_name('extract-task.py')),'--package',str(a.package),'--task',e['task'],'--video',str(a.source/e['source']),'--output',str(directory/'measurements.json'),'--model',e['model'],'--seed',str(e['seed']),'--localization']
 env={**os.environ,'CUDA_VISIBLE_DEVICES':'0','OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','HF_HUB_OFFLINE':'1'}
 with (directory/'backend.log').open('w') as log:result=subprocess.run(cmd,stdout=log,stderr=log,env=env,timeout=1200)
 if result.returncode or not (directory/'localization.mp4').exists():raise RuntimeError(f'{e["model"]}/{e["task"]}/{e["seed"]}: see {directory}/backend.log')
 features=json.loads((directory/'localization.json').read_text());provenance.write_text(json.dumps(dict(codeSha256=codehash,sourceSha256=e['sourceSha256'],source=e['source'],command=cmd,framesWithGeometry=sum(bool(f['features']) for f in features['frames']),previewFrames=len(features['frames'])),indent=2))
 return f'{e["model"]}/{e["task"]}/{e["seed"]}: generated'
errors=[]
with concurrent.futures.ThreadPoolExecutor(a.workers) as pool:
 futures={pool.submit(run,e):e for e in entries}
 for i,f in enumerate(concurrent.futures.as_completed(futures),1):
  try:print(f'{i}/{len(entries)} {f.result()}',flush=True)
  except Exception as error:errors.append(str(error));print('ERROR',error,flush=True)
print('DONE',len(entries),'errors',len(errors),flush=True)
if errors:sys.exit(1)
