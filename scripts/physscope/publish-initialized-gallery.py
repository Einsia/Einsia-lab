"""Publish a validated initialization rerun without changing leaderboard data."""
import argparse, hashlib, json, shutil
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public';ASSETS=PUBLIC/'physscope/all_test'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--publish',action='store_true');args=p.parse_args()
active=PUBLIC/'physscope/video-gallery.json';candidate=ASSETS/'initialized-catalogue.json'
old=json.loads(active.read_text());new=json.loads(candidate.read_text())
key=lambda e:(e['model'],e['task'],e['seed'],e['sourceSha256'])
assert {key(e) for e in old['entries']}=={key(e) for e in new['entries']}
updated=[e for e in new['entries'] if e.get('initializationRun')]
assert len(updated)==191
assert all(e['annotated'] and e['status']!='blocked' for e in updated)
assert all(e['annotated'] for e in new['entries'] if key(e) in {key(x) for x in old['entries'] if x['annotated']})
summary={'source':new['source'],'initializedSamples':len(updated),'newVideos':len(updated),
         'taskCounts':dict(Counter(e['task'] for e in updated)),
         'byTask':{task:{'samples':sum(e['task']==task for e in updated),
                         'measurable':sum(e['task']==task and e['status']=='complete' for e in updated),
                         'visualizations':sum(e['task']==task and bool(e['annotated']) for e in updated)}
                   for task in sorted({e['task'] for e in updated})},
         'extractionStatuses':dict(Counter(e['status'] for e in updated)),
         'coverage':new['coverage'],'historicalLeaderboardChanged':False,
         'note':'Fresh frame-zero initialization, SAM2 masks, CoTracker tracks and task measurements. Extraction failure retains visual evidence and is not automatically a physical failure.'}
(ASSETS/'initialization-rerun-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
if args.publish:
    archive=ASSETS/'catalogue-before-initialization-rerun.json'
    if not archive.exists():shutil.copyfile(active,archive)
    for target in [active,ASSETS/'catalogue.json']:
        tmp=target.with_suffix('.tmp');shutil.copyfile(candidate,tmp);tmp.replace(target)
    for e in updated:
        (PUBLIC/e['original'].lstrip('/')).with_name('entry.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
    print('Published')
print(json.dumps(summary,ensure_ascii=False,indent=2))
