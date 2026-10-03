"""Prepare a complete candidate catalogue; explicitly publish after validation."""
import argparse, json, shutil
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public';ACTIVE=PUBLIC/'physscope/video-gallery.json'
p=argparse.ArgumentParser();p.add_argument('--publish',action='store_true');a=p.parse_args()
gallery=json.loads(ACTIVE.read_text());asset=PUBLIC/'physscope'/gallery['source'];candidate=asset/'localization-catalogue.json'
if a.publish:
 prepared=json.loads(candidate.read_text())
 assert len(prepared['entries'])==len(gallery['entries']) and prepared['source']==gallery['source']
 archive=asset/'catalogue-before-localization.json'
 if not archive.exists():shutil.copyfile(ACTIVE,archive)
 for path in [ACTIVE,asset/'catalogue.json']:
  temporary=path.with_suffix('.tmp');shutil.copyfile(candidate,temporary);temporary.replace(path)
 for e in prepared['entries']:
  (PUBLIC/e['original'].lstrip('/')).with_name('entry.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
 print('Published',prepared['coverage']);raise SystemExit
changed=0;metric_matches=0;differences=[]
TASKS={'P1','P2','P5','P8a','P8b','P14','P16','P18','P20','P21','P45','P48','P7','P8c','P10','P12','P27'}
for e in gallery['entries']:
 if e['task'] not in TASKS:continue
 folder=(PUBLIC/e['original'].lstrip('/')).parent/'debug-localization';url='/'+str(folder.relative_to(PUBLIC));provenance=json.loads((folder/'provenance.json').read_text())
 assert provenance['sourceSha256']==e['sourceSha256']
 assert all((folder/name).is_file() for name in ['localization.mp4','localization.json','measurements.json'])
 old=json.loads((PUBLIC/e['measurement'].lstrip('/')).read_text());new=json.loads((folder/'measurements.json').read_text())
 if old.get('mode')=='ungated_physics_extraction':
  matches=all(v['available']==new['metrics'][k]['extract_success'] and v['value']==new['metrics'][k].get('metric') for k,v in old['metrics'].items())
 else:matches=json.dumps(old['metrics'],sort_keys=True)==json.dumps(new['metrics'],sort_keys=True)
 # Re-inference can differ numerically; do not overwrite the historical record.
 for key,value in old['metrics'].items():
  if isinstance(value,dict):
   assert value.get('available',value.get('extract_success'))==new['metrics'][key].get('extract_success'), ('Extraction flag changed',e['model'],e['task'],e['seed'],key)
 if matches:metric_matches+=1
 else:differences.append({'model':e['model'],'task':e['task'],'seed':e['seed'],'previous':old['metrics'],'preview':new['metrics']})
 e.update(annotated=url+'/localization.mp4',annotationKind='localization_overlay',visualizationMeasurement=url+'/measurements.json',frames=None,features=url+'/localization.json',log=url+'/backend.log',localizationCodeSha256=provenance['codeSha256'],localizationProvenance=provenance,reason='')
 changed+=1
assert changed==sum(e['task'] in TASKS for e in gallery['entries'])
gallery['coverage']={'originals':len(gallery['entries']),'annotated':sum(bool(e['annotated']) for e in gallery['entries']),'models':len({e['model'] for e in gallery['entries']}),'tasks':len({e['task'] for e in gallery['entries']}),'annotationKinds':dict(Counter(e.get('annotationKind') or 'none' for e in gallery['entries'])),'localizationReplacements':changed,'exactRerunMetricMatches':metric_matches,'rerunMetricDifferences':len(differences),'historicalMeasurementsPreserved':True}
(asset/'localization-rerun-comparison.json').write_text(json.dumps({'note':'Re-inference values are separate from preserved historical measurements. All extraction flags agree; leaderboard unchanged.','compared':changed,'exactMatches':metric_matches,'differences':differences},ensure_ascii=False,indent=2)+'\n')
candidate.write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n')
print('Prepared',gallery['coverage'])
