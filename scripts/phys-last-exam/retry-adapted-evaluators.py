"""Retry previously blocked tasks, prepare a catalogue for validation/publication."""
import argparse,concurrent.futures,hashlib,json,os,shutil,subprocess,sys
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public'
p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--source',type=Path,required=True);p.add_argument('--workers',type=int,default=4);a=p.parse_args()
gallery=json.loads((PUBLIC/'phys-last-exam/video-gallery.json').read_text());assert gallery['source']==a.source.name
entries=[e for e in gallery['entries'] if e['status']=='blocked']
codehash=hashlib.sha256(b''.join(p.read_bytes() for p in sorted(a.package.rglob('*.py')))+b''.join(p.read_bytes() for p in sorted((a.package/'g3').glob('P*/evaluator/*.yaml')))+(a.package/'local_resources.json').read_bytes()).hexdigest()
def run(old):
 e=dict(old);directory=(PUBLIC/e['original'].lstrip('/')).parent/'debug-adapted';directory.mkdir(exist_ok=True);record=directory/'entry.json'
 if record.exists():
  previous=json.loads(record.read_text())
  if previous.get('adaptedCodeSha256')==codehash and previous['sourceSha256']==e['sourceSha256'] and hashlib.sha256((a.source/e['source']).read_bytes()).hexdigest()==e['sourceSha256']:return previous
 source=a.source/e['source'];assert hashlib.sha256(source.read_bytes()).hexdigest()==e['sourceSha256']
 raw=directory/'measurements.json';log=directory/'backend.log'
 cmd=[sys.executable,str(Path(__file__).with_name('extract-task.py')),'--package',str(a.package),'--task',e['task'],'--video',str(source),'--output',str(raw),'--model',e['model'],'--seed',str(e['seed']),'--localization']
 env={**os.environ,'CUDA_VISIBLE_DEVICES':'0','OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','HF_HUB_OFFLINE':'1'}
 with log.open('w') as stream:r=subprocess.run(cmd,stdout=stream,stderr=stream,env=env,timeout=900)
 assert r.returncode in [0,1],f'Backend failed (exit {r.returncode}): {log}'
 assert raw.exists(),f'{e["model"]}/{e["task"]}/{e["seed"]}: no result, see {log}'
 data=json.loads(raw.read_text());text=json.dumps(data);assert not any(s in text for s in ['environment_error','runtime_error','configuration_error']),f'Runtime failure: {log}'
 url='/'+str(directory.relative_to(PUBLIC));videos=sorted(directory.rglob('*.mp4'),key=lambda p:('overlay' not in p.name,str(p)))
 # A missing initialization is a blocked input, not a physical failure.
 missing='Missing reviewed first-frame annotations' in text
 e['previousMeasurement']=e.get('measurement');e['measurement']=url+'/measurements.json';e['log']=url+'/backend.log'
 e['adaptedCodeSha256']=codehash;e['adaptedSourceSha256']=e['sourceSha256'];e['adaptation']={'command':cmd,'localResources':json.loads((a.package/'local_resources.json').read_text()),'sourceSha256':e['sourceSha256']}
 validity=data.get('metric_validity',data.get('statuses',{}).get('metric_validity'))
 if isinstance(validity,dict):checks=list(validity.values())
 else:
  checks=[m['extract_success'] for m in data.get('metrics',{}).values() if isinstance(m,dict) and m.get('extract_success') is not None]
  if not checks and 'extract_success' in data:checks=[data['extract_success']]
 e['definedMetrics']=len(checks);e['availableMetrics']=sum(v is True for v in checks)
 e['status']='blocked' if missing else 'complete' if checks and all(v is True for v in checks) else 'partial' if e['availableMetrics'] else 'unavailable'
 e['reason']='Missing reviewed first-frame annotation matching this video hash.' if missing else ''
 if videos:
  selected=videos[0];target=directory/'annotated.mp4'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(selected),'-an','-vf','scale=960:-2','-c:v','libx264','-threads','1','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True)
  e['annotated']=url+'/annotated.mp4';e['annotationKind']='native_overlay'
 elif not missing:e['reason']='Measurement finished without exported overlay; see debug log.'
 figures=sorted(directory.glob('*.png'))
 if figures:e['figure']=url+'/'+figures[0].name
 record.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n');return e
updates={};errors=[]
with concurrent.futures.ThreadPoolExecutor(a.workers) as pool:
 futures={pool.submit(run,e):e for e in entries}
 for i,f in enumerate(concurrent.futures.as_completed(futures),1):
  try:
   e=f.result();updates[(e['model'],e['task'],e['seed'])]=e;print(f'{i}/{len(entries)} {e["model"]}/{e["task"]}/{e["seed"]}: {e["status"]} video={bool(e["annotated"])}',flush=True)
  except Exception as error:errors.append(str(error));print('ERROR',error,flush=True)
if errors:raise RuntimeError(errors)
gallery['entries']=[updates.get((e['model'],e['task'],e['seed']),e) for e in gallery['entries']]
gallery['coverage']={'originals':len(gallery['entries']),'annotated':sum(bool(e['annotated']) for e in gallery['entries']),'models':len({e['model'] for e in gallery['entries']}),'tasks':len({e['task'] for e in gallery['entries']}),'annotationKinds':dict(Counter(e.get('annotationKind') or 'none' for e in gallery['entries']))}
(PUBLIC/'phys-last-exam'/a.source.name/'adapted-catalogue.json').write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n')
print('DONE',gallery['coverage'],flush=True)
