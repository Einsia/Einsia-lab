"""Merge staged native overlays and normalize availability; publish only on request.
Run validate-video-gallery.py against the prepared catalogue before --publish.
"""
import argparse, hashlib, json, shutil
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public'
p=argparse.ArgumentParser();p.add_argument('--collection',default='all_test_1');p.add_argument('--supplement',type=Path);p.add_argument('--publish',action='store_true');a=p.parse_args()
asset=PUBLIC/'physscope'/a.collection;manifest=asset/'catalogue.json';gallery=json.loads(manifest.read_text())
for e in gallery['entries']:
 directory=asset/e['model']/e['task']/str(e['seed']);url='/'+str(directory.relative_to(PUBLIC))
 stage=a.supplement/e['model']/e['task']/str(e['seed']) if a.supplement else None
 if stage and (stage/'measurements.json').exists():
  if (stage/'provenance.json').exists():
   provenance=json.loads((stage/'provenance.json').read_text());assert provenance['sourceSha256']==e['sourceSha256']
  else:
   raw=json.loads((stage/'measurements.json').read_text());sourcefile=Path(raw.get('video_path',raw.get('video','')))
   assert sourcefile.is_file() and hashlib.sha256(sourcefile.read_bytes()).hexdigest()==e['sourceSha256']
   provenance={'sourceSha256':e['sourceSha256'],'measurementSha256':hashlib.sha256((stage/'measurements.json').read_bytes()).hexdigest(),'result':'Extraction completed without annotated media'}
  debug=directory/'debug-resolved';shutil.copytree(stage,debug,dirs_exist_ok=True)
  e.update(annotated=url+'/debug-resolved/annotated.mp4' if (stage/'annotated.mp4').exists() else None,measurement=url+'/debug-resolved/measurements.json',log=url+'/debug-resolved/backend.log',annotationKind='native_overlay' if (stage/'annotated.mp4').exists() else None,status='unavailable',reason='' if (stage/'annotated.mp4').exists() else 'Evaluator could not extract sufficient features to produce annotated media.',supplement=provenance)
  images=sorted(list((debug/'debug').rglob('*.png'))+list((debug/'debug').rglob('*.jpg')))
  e['figure']=url+'/'+str(images[0].relative_to(directory)) if images else None
 if e.get('measurement') and not e.get('frames'):
  data=json.loads((PUBLIC/e['measurement'].lstrip('/')).read_text())
  metrics=data.get('metrics',{});validity=data.get('statuses',{}).get('metric_validity',data.get('metric_validity'))
  if isinstance(validity,dict):
   checks=list(validity.values())
  else:
   checks=[m.get('extract_success',m.get('available')) for m in metrics.values() if isinstance(m,dict) and m.get('extract_success',m.get('available')) is not None]
   if not checks and 'extract_success' in data:checks=[data['extract_success']]
  e['availableMetrics']=sum(v is True for v in checks);e['definedMetrics']=len(checks)
  if e['status']!='blocked':
   e['status']='complete' if checks and all(v is True for v in checks) else 'partial' if e['availableMetrics'] else 'unavailable'
   e['reason']='' if e['annotated'] else e['reason']
 (directory/'entry.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
gallery['coverage']={'originals':len(gallery['entries']),'annotated':sum(bool(e['annotated']) for e in gallery['entries']),'models':len({e['model'] for e in gallery['entries']}),'tasks':len({e['task'] for e in gallery['entries']}),'annotationKinds':dict(Counter(e.get('annotationKind') or 'none' for e in gallery['entries']))}
manifest.write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n')
if a.publish:
 current=PUBLIC/'physscope/video-gallery.json'
 previous=json.loads(current.read_text()) if current.exists() else None
 if previous and previous['source']!=gallery['source']:
  archive=PUBLIC/'physscope'/('video-gallery-'+previous['source']+'.json')
  if not archive.exists():shutil.copyfile(current,archive)
 temporary=current.with_suffix('.tmp');shutil.copyfile(manifest,temporary);temporary.replace(current)
print(json.dumps(gallery['coverage'],indent=2))
