"""Resolve optional P4/P34 and hash-matched refined-task runtime assets without changing evaluator rules.
Run after the main extractor, or concurrently with --staging outside its output.
Staged debug folders can be merged with publish-video-gallery.py when complete.
"""
import argparse, concurrent.futures, hashlib, json, os, re, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser()
for name in ['package','source','staging','physbench','sam2-vendor','sam2-checkpoint','dino-model']:p.add_argument('--'+name,required=True)
p.add_argument('--workers',type=int,default=2)
p.add_argument('--cotracker-checkpoint');p.add_argument('--cotracker-source')
p.add_argument('--only-model');a=p.parse_args();package=Path(a.package);source=Path(a.source);staging=Path(a.staging)
config=json.loads((package/'g3/P4/evaluator/config.json').read_text())
config.update(physbench_project=a.physbench,tracker_gpu='0')
staging.mkdir(parents=True,exist_ok=True);configfile=staging/'p4-runtime-config.json';configfile.write_text(json.dumps(config,indent=2))
def run(video):
 task,seed=re.search(r'_(P\d+[a-z]?)_seed(\d+)',video.name).groups();model=video.relative_to(source).parts[0]
 dest=staging/model/task/seed;dest.mkdir(parents=True,exist_ok=True)
 raw=dest/'measurements.json';debug=dest/'debug';debug.mkdir(exist_ok=True)
 taskdir=next(package.glob('g*/'+task))
 if task=='P4':
  cmd=[sys.executable,str(taskdir/'evaluator/evaluate_raw_legacy.py'),'--video',str(video),'--output',str(raw),'--debug-dir',str(debug),'--config',str(configfile),'--no-cotracker']
 else:
  cmd=[sys.executable,str(taskdir/'evaluator/measure_backend.py'),'--video_path',str(video),'--image_path',str(taskdir/'first_frame.png'),'--video_prompt_file',str(taskdir/'prompts/video.txt'),'--model',model,'--seed',seed,'--sample_id',video.stem,'--output',str(raw),'--debug_dir',str(debug),'--device','cuda:0','--threads','2','--sam2_checkpoint',a.sam2_checkpoint,'--dino_model',a.dino_model]
 if task not in ['P4','P34']:
  cmd+=['--annotation',str(taskdir/'annotations/first_frame_annotations.json'),'--cotracker_checkpoint',a.cotracker_checkpoint]
 env={**os.environ,'PYTHONPATH':a.sam2_vendor+(':'+a.cotracker_source if a.cotracker_source else ''),'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','HF_HUB_OFFLINE':'1','CUDA_VISIBLE_DEVICES':'0'}
 with (dest/'backend.log').open('w') as log:
  result=subprocess.run(cmd,stdout=log,stderr=log,env=env,timeout=600)
 payload=json.loads(raw.read_text()) if raw.exists() else {}
 videos=sorted(debug.rglob('*.mp4'),key=lambda p:('overlay' not in p.name,str(p)))
 okay=result.returncode in [0,1] and payload and videos and 'environment_error' not in json.dumps(payload)
 if okay:
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(videos[0]),'-an','-vf','scale=960:-2','-c:v','libx264','-threads','1','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(dest/'annotated.mp4')],check=True)
  (dest/'provenance.json').write_text(json.dumps({'command':cmd,'sourceSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'adapterSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'runtimeAssets':{'physbench':a.physbench,'sam2Vendor':a.sam2_vendor,'sam2Checkpoint':a.sam2_checkpoint,'dinoModel':a.dino_model}},indent=2))
 return f'{model}/{task}/{seed}: '+('generated' if okay else 'unavailable')
files=[]
for f in sorted(source.glob('*/gpt/*.mp4')):
 if a.only_model and f.relative_to(source).parts[0]!=a.only_model:continue
 match=re.search(r'_(P\d+[a-z]?)_seed',f.name)
 if not match:continue
 task=match[1]
 if task in ['P4','P34']:files.append(f)
 elif task in ['P37','P38','P39','P41','P43','P49'] and a.cotracker_checkpoint and a.cotracker_source:
  annotation=next(package.glob('g*/'+task))/'annotations/first_frame_annotations.json'
  if annotation.exists() and json.loads(annotation.read_text()).get('source_video_sha256')==hashlib.sha256(f.read_bytes()).hexdigest():files.append(f)
with concurrent.futures.ThreadPoolExecutor(a.workers) as pool:
 for i,result in enumerate(pool.map(run,files),1):print(f'{i}/{len(files)} {result}',flush=True)
