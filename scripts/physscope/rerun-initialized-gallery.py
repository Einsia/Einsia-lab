"""Rerun blocked measurements with reviewed per-video frame-zero inputs."""
import argparse, concurrent.futures, hashlib, json, os, queue, subprocess, sys
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public'
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--package',type=Path,required=True);p.add_argument('--source',type=Path,required=True)
p.add_argument('--gpus',default='0,1,2,3,4,5,6,7');p.add_argument('--pilot',action='store_true')
a=p.parse_args();gallery=json.loads((PUBLIC/'physscope/video-gallery.json').read_text())
entries=[e for e in gallery['entries'] if e['status']=='blocked' or e.get('initializationRun')]
if a.pilot:
    entries=[e for e in entries if (e['model']=='minimax-h3' and e['seed']==42) or (e['model']=='lingbot-video-moe-30b-a3b' and e['task']=='P38' and e['seed']==42) or (e['model']=='cogvideox1.5-5b-i2v' and e['task']=='P49' and e['seed']==42)]
gpu_queue=queue.Queue()
for gpu in a.gpus.split(','):gpu_queue.put(gpu)
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
codehash=hashlib.sha256(b''.join(p.read_bytes() for p in sorted((a.package/'refined_evaluators').glob('*.py')))).hexdigest()
def run(old):
    e=dict(old);source=a.source/e['source'];assert digest(source)==e['sourceSha256']
    init=PUBLIC/'physscope/all_test/initialization'/('v3_'+e['model'])/'inputs/annotations'/ (source.stem+'.json')
    ann=json.loads(init.read_text());assert ann['source_video_sha256']==e['sourceSha256']
    still=Path(ann['source_image']);assert digest(still)==ann['source_image_sha256']
    directory=(PUBLIC/e['original'].lstrip('/')).parent/'debug-initialized';directory.mkdir(exist_ok=True)
    record=directory/'entry.json';signature={'source':digest(source),'annotation':digest(init),'code':codehash,'resources':digest(a.package/'local_resources.json')}
    if record.exists():
        cached=json.loads(record.read_text())
        if cached.get('initializationRun',{}).get('signature')==signature:return cached
    gpu=gpu_queue.get()
    try:
        raw=directory/'measurements.json';log=directory/'backend.log'
        command=[sys.executable,'-c','import sys; from refined_evaluators.runtime import run; sys.exit(run(sys.argv.pop(1)))',e['task'],'--video_path',str(source),'--image_path',str(still),'--annotation',str(init),'--model',e['model'],'--seed',str(e['seed']),'--sample_id',source.stem,'--output',str(raw),'--debug_dir',str(directory),'--device','cuda:0','--threads','2','--reuse_masks','--reuse_tracks']
        env={**os.environ,'PYTHONPATH':str(a.package),'CUDA_VISIBLE_DEVICES':gpu,'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','HF_HUB_OFFLINE':'1','TOKENIZERS_PARALLELISM':'false'}
        with log.open('w') as stream:result=subprocess.run(command,stdout=stream,stderr=stream,env=env,timeout=3600)
        assert result.returncode in [0,1],f'Exit {result.returncode}: {log}'
        data=json.loads(raw.read_text());m=data['verbose']['M1']
        assert m['status'] not in ['environment_error','runtime_error','configuration_error'],f"{m['status']}: {m['reason']}: {log}"
        assert 'Missing reviewed' not in str(m['reason'])
        video=next((directory/name for name in ['tracking_overlay.mp4','segmentation_overlay.mp4'] if (directory/name).exists()),None)
        assert video is not None,f'No overlay: {log}: {m["reason"]}'
        target=directory/'annotated.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-an','-vf','scale=960:-2','-c:v','libx264','-threads','2','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True)
        url='/'+str(directory.relative_to(PUBLIC));success=data['metrics']['M1']['extract_success'] is True
        e.update(previousMeasurement=e.get('measurement'),measurement=url+'/measurements.json',log=url+'/backend.log',annotated=url+'/annotated.mp4',annotationKind='native_overlay',status='complete' if success else 'unavailable',definedMetrics=1,availableMetrics=int(success),reason=m.get('reason') or '',figure=url+'/first_frame_identity.png')
        e['initializationRun']={'signature':signature,'annotation':'/'+str(init.relative_to(PUBLIC)),'frameZero':'/'+str(still.relative_to(PUBLIC)),'command':command,'measurementRecomputed':True,'historicalLeaderboardChanged':False}
        record.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
        return e
    finally:gpu_queue.put(gpu)
updates={};errors=[]
with concurrent.futures.ThreadPoolExecutor(gpu_queue.qsize()) as pool:
    futures={pool.submit(run,e):e for e in entries}
    for i,f in enumerate(concurrent.futures.as_completed(futures),1):
        try:
            e=f.result();updates[(e['model'],e['task'],e['seed'])]=e
            print(f'{i}/{len(entries)} {e["model"]}/{e["task"]}/{e["seed"]}: {e["status"]}; video={bool(e["annotated"])}',flush=True)
        except Exception as ex:errors.append(str(ex));print('ERROR',ex,flush=True)
if errors:raise RuntimeError(errors)
gallery['entries']=[updates.get((e['model'],e['task'],e['seed']),e) for e in gallery['entries']]
gallery['coverage'].update(annotated=sum(bool(e['annotated']) for e in gallery['entries']),annotationKinds=dict(Counter(e.get('annotationKind') or 'none' for e in gallery['entries'])),statuses=dict(Counter(e['status'] for e in gallery['entries'])),initializedSamples=len(updates))
target=PUBLIC/'physscope/all_test'/('initialized-pilot-catalogue.json' if a.pilot else 'initialized-catalogue.json')
target.write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n');print('DONE',gallery['coverage'],flush=True)
