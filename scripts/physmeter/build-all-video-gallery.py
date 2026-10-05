"""Index a source collection and extract actual evaluator debug media.
Missing annotations/dependencies are recorded separately from extraction failure.
Never label a copy of the original as an annotated video.
"""
import argparse,hashlib,json,os,re,shutil,subprocess,sys,traceback
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--package',required=True);p.add_argument('--source',required=True);p.add_argument('--workers',type=int,default=4);p.add_argument('--pilot',action='store_true');p.add_argument('--retry',action='store_true');p.add_argument('--reuse-catalogue',type=Path,help='Reuse prior evidence only for byte-identical model/task/seed samples, preserving its provenance');args=p.parse_args()
package=Path(args.package);source=Path(args.source)
asset=ROOT/'public/physmeter'/source.name;asset.mkdir(exist_ok=True)
task_paths={p.name:p for p in package.glob('g*/P*') if p.is_dir()}
native_localization=(package/'shared/physeval/debug_video.py').exists()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
codehash=hashlib.sha256(''.join(sha(p) for p in [Path(__file__),Path(__file__).with_name('extract-task.py'),Path(__file__).with_name('build-video-gallery.py')]+sorted(package.rglob('*.py'))).encode()).hexdigest()
reuse_gallery=json.loads(args.reuse_catalogue.read_text()) if args.reuse_catalogue else {}
reuse_entries={(e['model'],e['task'],e['seed']):e for e in reuse_gallery.get('entries',[])}
files=sorted(source.glob('*/gpt/g*_P*_seed*.mp4'))
if args.pilot:
 selected={}
 for f in files:selected.setdefault(re.search(r'_(P\d+[a-z]?)_',f.name)[1],f)
 files=list(selected.values())
def probe(path):
 return json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',str(path)]))['streams'][0]
def run(f):
 task,seed=re.search(r'_(P\d+[a-z]?)_seed(\d+)',f.name).groups();seed=int(seed);model=f.relative_to(source).parts[0]
 directory=asset/model/task/str(seed);directory.mkdir(parents=True,exist_ok=True)
 record=directory/'entry.json';digest=sha(f)
 if record.exists() and not args.retry:
  entry=json.loads(record.read_text())
  if entry['sourceSha256']==digest and (entry['codeSha256']==codehash or entry.get('reuse',{}).get('generatorCodeSha256')==codehash):return entry
 prior=reuse_entries.get((model,task,seed))
 if prior and prior['sourceSha256']==digest:
  original_prior=ROOT/'public'/prior['original'].lstrip('/')
  assert sha(original_prior)==digest
  shutil.copytree(original_prior.parent,directory,dirs_exist_ok=True)
  entry=json.loads(json.dumps(prior));oldprefix=str(original_prior.parent.relative_to(ROOT/'public'));newprefix=str(directory.relative_to(ROOT/'public'))
  for key in ['original','annotated','poster','measurement','frames','figure','log','features','visualizationMeasurement']:
   if entry.get(key):entry[key]=entry[key].replace('/'+oldprefix+'/', '/'+newprefix+'/')
  entry['source']=str(f.relative_to(source))
  entry['reuse']={'sourceCollection':reuse_gallery['source'],'sourceSha256':digest,'byteIdentityVerified':True,'generatorCodeSha256':codehash,'note':'Reused extraction evidence on identical source bytes; original extraction provenance retained.'}
  write(record,entry);return entry
 debug=directory/'debug';debug.mkdir(exist_ok=True)
 original=directory/'original.mp4'
 if not original.exists() or sha(original)!=digest:shutil.copyfile(f,original)
 meta=probe(f);duration=float(meta['duration']);url=f'/physmeter/{source.name}/{model}/{task}/{seed}'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(f),'-frames:v','1','-vf','scale=640:-2','-threads','1',str(directory/'poster.jpg')],check=True)
 raw=debug/'measurements.json';log=debug/'backend.log'
 env={**os.environ,'CUDA_VISIBLE_DEVICES':'0','OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','HF_HUB_OFFLINE':'1'}
 cmd=[sys.executable,str(Path(__file__).with_name('extract-task.py')),'--package',str(package),'--task',task,'--video',str(f),'--output',str(raw),'--model',model,'--seed',str(seed),'--assets',str(asset),'--source-root',str(source),'--code-hash',codehash]
 if native_localization:cmd.append('--localization')
 try:
  with log.open('w') as stream:result=subprocess.run(cmd,stdout=stream,stderr=stream,env=env,timeout=420)
  code=result.returncode
 except subprocess.TimeoutExpired:code=124
 if code==0 and task in ['P8a','P14','P21','P45'] and not native_localization:
  return json.loads(record.read_text())
 payload=json.loads(raw.read_text()) if raw.exists() else {}
 metrics=payload.get('metrics',{})
 available=sum(isinstance(v,dict) and v.get('extract_success') is True for v in metrics.values())
 defined=sum(isinstance(v,dict) and v.get('extract_success') is not None for v in metrics.values())
 if not defined and 'extract_success' in payload:defined=1;available=int(bool(payload['extract_success']))
 logtext=log.read_text(errors='replace')
 errors=[l for l in logtext.splitlines() if any(s in l for s in ['Error:','Missing ','mismatch','No such file','not found','environment_error','configuration_error','failure_reason'])]
 reason=(errors[-1] if errors else ('Backend time limit exceeded' if code==124 else ''))[:600]
 # Scores can be unavailable after a legitimate extraction, but environment errors are distinct.
 blocked=bool(reason and any(word in reason for word in ['cannot infer','no fixed first-frame','project missing','checkpoint missing'])) or code not in [0,1] or not payload or any(s in json.dumps(payload) for s in ['environment_error','configuration_error','runtime_error'])
 status='blocked' if blocked else ('complete' if available==defined and defined else 'partial' if available else 'unavailable')
 videos=sorted(debug.rglob('*.mp4'),key=lambda p:('localization' not in p.name,'overlay' not in p.name,'track' not in p.name,str(p)))
 figures=sorted(list(debug.rglob('*.png'))+list(debug.rglob('*.jpg')),key=lambda p:('measurement' not in p.name,'overlay' not in p.name,str(p)))
 annotated=None;kind=None
 if not blocked and videos:
  selected=videos[0]
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(selected),'-an','-vf','scale=960:-2','-c:v','libx264','-threads','1','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(directory/'annotated.mp4')],check=True)
  annotated=url+'/annotated.mp4';kind='localization_overlay' if selected.name=='localization.mp4' else 'native_overlay'
 elif not blocked and figures:
  # Preserve evaluator plots as clearly labelled static evidence beside the moving source.
  selected=figures[0]
  graph="[0:v]fps=8,scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2[left];[1:v]scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2[right];[left][right]hstack,pad=1280:520:0:40,drawtext=text='Original video | Static evaluator debug figure (not framewise tracking)':x=15:y=10:fontsize=18:fontcolor=white[out]"
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(f),'-loop','1','-i',str(selected),'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-t',str(duration),'-an','-c:v','libx264','-threads','1','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(directory/'annotated.mp4')],check=True)
  annotated=url+'/annotated.mp4';kind='static_debug_panel'
 if not annotated and not reason:reason='Evaluator did not emit annotated media.'
 entry=dict(model=model,task=task,seed=seed,original=url+'/original.mp4',annotated=annotated,poster=url+'/poster.jpg',measurement=url+'/debug/measurements.json' if raw.exists() else None,frames=None,figure=url+'/'+str(figures[0].relative_to(directory)) if figures else None,log=url+'/debug/backend.log',source=str(f.relative_to(source)),sourceSha256=digest,codeSha256=codehash,duration=duration,sourceFrames=int(meta.get('nb_frames',0)),availableMetrics=available,definedMetrics=defined,status=status,annotationKind=kind,reason=reason)
 if kind=='localization_overlay':
  entry['features']=url+'/debug/localization.json'
  entry['localizationProvenance']={'sourceSha256':digest,'codeSha256':codehash}
 write(record,entry);return entry
entries=[]
with ThreadPoolExecutor(args.workers) as pool:
 futures={pool.submit(run,f):f for f in files}
 for future in as_completed(futures):
  try:
   entry=future.result();entries.append(entry)
   print(f'{len(entries)}/{len(files)} {entry["task"]} {entry["model"]} {entry["seed"]}: {entry["status"]} {entry["annotationKind"]} {entry["reason"]}',flush=True)
  except Exception:print('ERROR',futures[future],traceback.format_exc(),flush=True)
assert len(entries)==len(files)
entries.sort(key=lambda e:(e['model'],int(re.search(r'\d+',e['task'])[0]),e['task'],e['seed']))
write(asset/('pilot.json' if args.pilot else 'catalogue.json'),dict(generatedAt=datetime.now(timezone.utc).isoformat(),source=source.name,mode='ungated_physics_extraction',package='vdmbench2/vdmbench/v3',entries=entries))
print('DONE',len(entries),flush=True)
