"""Prepare or publish adapted catalogue; validate its assets before --publish."""
import argparse,json,shutil
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public';ACTIVE=PUBLIC/'physscope/video-gallery.json'
p=argparse.ArgumentParser();p.add_argument('--collection',default='all_test');p.add_argument('--publish',action='store_true');a=p.parse_args()
asset=PUBLIC/'physscope'/a.collection;candidate=asset/'adapted-catalogue.json';gallery=json.loads(candidate.read_text())
assert gallery['source']==a.collection
for e in gallery['entries']:
 if not e.get('adaptedCodeSha256'):continue
 data=json.loads((PUBLIC/e['measurement'].lstrip('/')).read_text())
 if e['task']=='P9':
  okay=data['status']['extract_success'] is True
  e['definedMetrics']=1;e['availableMetrics']=int(okay);e['status']='complete' if okay else 'unavailable'
 e['adaptation']['weightProvenance']='/physscope/'+a.collection+'/adapted-weight-provenance.json'
assert all(e['annotated'] for e in gallery['entries'] if e['task'] in ['P3','P6','P9'])
assert sum(e['task'] in ['P3','P6','P9'] for e in gallery['entries'])==96
gallery['coverage'].update(statuses=dict(Counter(e['status'] for e in gallery['entries'])),adaptedSamples=287,newG3Videos=96)
candidate.write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n')
if a.publish:
 old=json.loads(ACTIVE.read_text());assert old['source']==gallery['source']
 assert {(e['model'],e['task'],e['seed'],e['sourceSha256']) for e in old['entries']}=={(e['model'],e['task'],e['seed'],e['sourceSha256']) for e in gallery['entries']}
 archive=asset/'catalogue-before-resource-adaptation.json'
 if not archive.exists():shutil.copyfile(ACTIVE,archive)
 for target in [ACTIVE,asset/'catalogue.json']:
  temp=target.with_suffix('.tmp');shutil.copyfile(candidate,temp);temp.replace(target)
 for e in gallery['entries']:
  (PUBLIC/e['original'].lstrip('/')).with_name('entry.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
 print('Published')
print(gallery['coverage'])
