"""Validate a complete catalogue against the source collection and exported media."""
import argparse, hashlib, json, re, subprocess
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public'
p=argparse.ArgumentParser();p.add_argument('--catalogue',type=Path,default=PUBLIC/'phys-last-exam/video-gallery.json');p.add_argument('--source',type=Path);p.add_argument('--decode',action='store_true');p.add_argument('--decode-initialized',action='store_true',help='Fully decode new initialization overlays; inspect metadata for all other media');a=p.parse_args()
gallery=json.loads(a.catalogue.read_text());entries=gallery['entries']
triples={(e['model'],e['task'],e['seed']) for e in entries}
assert len(entries)==len(triples),'Duplicate model/task/seed'
if a.source:
 expected=set()
 for f in a.source.glob('*/gpt/g*_P*_seed*.mp4'):
  task,seed=re.search(r'_(P\d+[a-z]?)_seed(\d+)',f.name).groups();expected.add((f.relative_to(a.source).parts[0],task,int(seed)))
 assert triples==expected,(len(triples),len(expected))
 assert gallery['source']==a.source.name

def check(e):
 paths={k:PUBLIC/e[k].lstrip('/') for k in ['original','annotated','poster','measurement','frames','figure','log','features','visualizationMeasurement'] if e.get(k)}
 assert all(p.is_file() and (key=='log' or p.stat().st_size>0) for key,p in paths.items()),e
 assert hashlib.sha256(paths['original'].read_bytes()).hexdigest()==e['sourceSha256'],e['original']
 if a.source:assert hashlib.sha256((a.source/e['source']).read_bytes()).hexdigest()==e['sourceSha256']
 assert e['status']!='blocked' or not e['annotated']
 for key in ['original','annotated']:
  if key not in paths:continue
  data=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt,duration,nb_frames','-of','json',str(paths[key])]))['streams'][0]
  assert data['codec_name']=='h264' and data['pix_fmt']=='yuv420p',(paths[key],data)
  assert abs(float(data['duration'])-e['duration'])<.2,(paths[key],data['duration'],e['duration'])
  if key=='annotated' and (a.decode or (a.decode_initialized and e.get('initializationRun'))):
   decoded=subprocess.run(['ffmpeg','-v','error','-xerror','-threads','1','-i',str(paths[key]),'-f','null','-'],capture_output=True)
   assert decoded.returncode==0,decoded.stderr.decode()
 if 'measurement' in paths:json.loads(paths['measurement'].read_text())
 if e.get('initializationRun'):
  run=e['initializationRun'];annotation=PUBLIC/run['annotation'].lstrip('/');still=PUBLIC/run['frameZero'].lstrip('/')
  init=json.loads(annotation.read_text());raw=json.loads(paths['measurement'].read_text())
  assert hashlib.sha256(annotation.read_bytes()).hexdigest()==run['signature']['annotation']
  assert hashlib.sha256(still.read_bytes()).hexdigest()==init['source_image_sha256']
  assert init['source_video_sha256']==run['signature']['source']==e['sourceSha256']
  assert (raw['model'],raw['task_id'],raw['seed'])==(e['model'],e['task'],e['seed'])
  assert run['measurementRecomputed'] and not run['historicalLeaderboardChanged']
  assert e['annotated'] and e['status']!='blocked'
  assert raw['verbose']['M1']['status'] not in ['environment_error','runtime_error','configuration_error']
 if 'frames' in paths:
  raw=json.loads(paths['measurement'].read_text());frames=json.loads(paths['frames'].read_text())['frames']
  assert (raw['model'],raw['task'],raw['seed'])==(e['model'],e['task'],e['seed'])
  assert raw['codeSha256']==e['codeSha256'] and raw['sourceSha256']==e['sourceSha256']
  assert all(0<=f['sourceFrame']<e['sourceFrames'] for f in frames)
  assert all(x['sourceFrame']<y['sourceFrame'] for x,y in zip(frames,frames[1:]))
 if 'features' in paths:
  features=json.loads(paths['features'].read_text());frames=features['frames']
  assert features['task']==e['task'] and features['sourceFrames']==e['sourceFrames']
  assert all(0<=f['sourceFrame']<e['sourceFrames'] and abs(f['time']-f['sourceFrame']/features['sourceFps'])<1e-6 for f in frames)
  assert all(x['sourceFrame']<y['sourceFrame'] for x,y in zip(frames,frames[1:]))
  assert e['localizationProvenance']['sourceSha256']==e['sourceSha256']
 return e['status']
with ThreadPoolExecutor(8) as pool:counts=Counter(pool.map(check,entries))
print(f'PASS: {len(entries)} unique triples, {len({e[0] for e in triples})} models, {len({e[1] for e in triples})} tasks; exact originals, media codecs/durations, evidence links'+('; full annotation decode' if a.decode else '; full initialized annotation decode' if a.decode_initialized else ''))
print('Annotation types:',dict(Counter(e.get('annotationKind') or 'none' for e in entries)))
print('Extraction coverage, not physical success:',dict(counts))
