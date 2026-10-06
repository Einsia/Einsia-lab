"""Extract actual V3 physics features and render a portable video gallery.

Uses the supplied package's shared.physeval backends without changing them.
This is an ungated measurement/visualization run, NOT a new V3 leaderboard.
Requires numpy, scipy, opencv-python-headless, matplotlib, torch, transformers,
Pillow and ffmpeg. SAM2 weights are required for the two liquid tasks.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import importlib
import inspect
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import traceback

ROOT = Path(__file__).resolve().parents[2]
COLORS = [(70,190,255), (255,180,60), (130,230,100), (220,100,220)]

def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024), b''):h.update(chunk)
    return h.hexdigest()

def clean(value):
    import numpy as np
    if isinstance(value, dict):return {str(k):clean(v) for k,v in value.items()}
    if isinstance(value, (list,tuple)):return [clean(v) for v in value]
    if isinstance(value,np.ndarray):return clean(value.tolist())
    if isinstance(value,np.generic):return clean(value.item())
    if isinstance(value,float) and not math.isfinite(value):return None
    return value

def save(path,value):
    path.write_text(json.dumps(clean(value),ensure_ascii=False,indent=2,allow_nan=False)+'\n')

def init_worker(package, gpu):
    os.environ['CUDA_VISIBLE_DEVICES']=str(gpu)
    os.environ['OMP_NUM_THREADS']='2'
    os.environ['OPENBLAS_NUM_THREADS']='2'
    os.environ['EVALUATOR_TORCH_THREADS']='2'
    sys.path.insert(0,package)
    import cv2
    cv2.setNumThreads(2)

def build(job):
    import cv2
    import numpy as np
    from shared.physeval import Context, get_evaluator, read_clip
    from shared.physeval import liquid
    package, source_root, source_relative, public_root, code_hash = job
    source=Path(source_root)/source_relative
    model=source_relative.split('/')[0]
    match=re.fullmatch(r'(g\d+)_(P\d+[a-z]?)_seed(\d+)\.mp4',source.name)
    group, task, seed=match.group(1),match.group(2),int(match.group(3))
    folder=Path(public_root)/model/task/str(seed)
    folder.mkdir(parents=True,exist_ok=True)
    source_hash=digest(source)
    entry_path=folder/'entry.json'
    if entry_path.exists():
        entry=json.loads(entry_path.read_text())
        if entry['sourceSha256']==source_hash and entry['codeSha256']==code_hash and all((folder/f).exists() for f in ['original.mp4','annotated.mp4','debug/measurements.json']):return entry
    debug=folder/'debug';debug.mkdir(exist_ok=True)
    task_root=next(Path(package).glob(f'g*/{task}'))
    module=importlib.import_module(f'shared.physeval.tasks.{task.lower()}')
    clip=read_clip(source)
    captured={}
    # Tap existing debug arguments and segmentation outputs, returning them unchanged.
    original_debug=module._debug
    original_container=liquid.find_container
    def debug_tap(*args,**kwargs):
        captured.update(inspect.signature(original_debug).bind(*args,**kwargs).arguments)
        return original_debug(*args,**kwargs)
    def container_tap(*args,**kwargs):
        import torch
        # The package loads SAM2 in bf16 on CUDA but its processor returns fp32.
        # Autocast provides the model's intended inference precision.
        with torch.autocast(device_type='cuda',dtype=torch.bfloat16,enabled=torch.cuda.is_available()):
            value=original_container(*args,**kwargs)
        captured['container']=value
        return value
    module._debug=debug_tap
    liquid.find_container=container_tap
    context=Context(task_id=task, video_path=source_relative, image_path=str(task_root/'first_frame.png'), video_prompt=(task_root/'prompts/video.txt').read_text().strip(), model=model, seed=seed,debug_path=str(debug/'measurement.png'))
    try:result=get_evaluator(task)(clip,context)
    finally:
        module._debug=original_debug
        liquid.find_container=original_container
    metrics={key:dict(label=m.label, available=m.extract_success, value=m.value, reason=m.reason if hasattr(m,'reason') else '', details=m.to_verbose_json()) for key,m in result.metrics.items() if m.defined}
    count=sum(m['available'] for m in metrics.values())
    status='complete' if count==len(metrics) else ('partial' if count else 'unavailable')
    # Capture only raw measurement evidence; the legacy backend proxy is not a V3 score.
    save(debug/'measurements.json',dict(task=task,model=model,seed=seed,mode='ungated_physics_extraction',metrics=metrics,scene=result.scene,sourceSha256=source_hash,codeSha256=code_hash,scoring='No VLM gate or V3 total computed. Existing leaderboard is unchanged.'))
    fps=min(8.0,clip.fps)
    duration=clip.n/clip.fps
    output_count=max(1,math.ceil(duration*fps))
    width=min(960,clip.w);width-=width%2
    height=int(clip.h*width/clip.w);height-=height%2
    scale=width/clip.w
    banner=76
    temp=folder/'annotated.tmp.mp4'
    command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{width}x{height+banner}','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    frame_records=[]
    def point(p):return tuple(int(np.clip(round(float(v)*scale),-100000,100000)) for v in p)
    def line(frame,a,b,color,thickness=2):
        if np.isfinite(a).all() and np.isfinite(b).all():cv2.line(frame,point(a),point(b),color,thickness,cv2.LINE_AA)
    try:
        for output_index in range(output_count):
            index=min(clip.n-1,int(output_index*clip.fps/fps))
            original=clip[index]
            frame=cv2.resize(original,(width,height))
            record={'sourceFrame':index,'time':index/clip.fps}
            note='No reliable feature found in this frame'
            if task=='P8a':
                bobs=captured.get('bobs',[])
                tracks=[]
                for i,bob in enumerate(bobs):
                    color=COLORS[i%4]
                    xy=np.array([bob.track.x[index],bob.track.y[index]])
                    coords=np.column_stack((bob.track.x[:index+1],bob.track.y[:index+1]))
                    for a,b in zip(coords[:-1],coords[1:]):line(frame,a,b,color,1)
                    if np.isfinite(xy).all():
                        cv2.circle(frame,point(xy),6,color,2,cv2.LINE_AA)
                        if np.isfinite(bob.pivot).all():
                            line(frame,bob.pivot,xy,color)
                            cv2.drawMarker(frame,point(bob.pivot),color,cv2.MARKER_CROSS,12,2)
                    tracks.append(dict(xy=xy,pivot=bob.pivot,angle= bob.theta[index],periodFrames=bob.period))
                record['bobs']=tracks
                if tracks:note='Bob centroids, fitted pivots and measured trajectories'
            elif task=='P14':
                shadows=module._shadow_rays(original)
                common=None
                if len(shadows)>=module.MIN_LINES:
                    common,_=module._common_point([(np.array([s['cx'],s['cy']]),s['axis']) for s in shadows])
                for i,shadow in enumerate(shadows):
                    foot=np.array([shadow['cx'],shadow['cy']]);tip=foot+shadow['axis']*shadow['half_len'];color=COLORS[i%4]
                    line(frame,foot,tip,color,3)
                    cv2.circle(frame,point(foot),5,color,2)
                    if common is not None:line(frame,foot,common,color,1)
                if common is not None and np.isfinite(common).all():cv2.drawMarker(frame,point(common),(255,255,255),cv2.MARKER_CROSS,20,2)
                record.update(shadows=[{k:s[k] for k in ['cx','cy','axis','half_len','contrast']} for s in shadows],intersection=common)
                if shadows:note=f'{len(shadows)} shadow rays; '+('intersection fitted' if common is not None else 'not enough rays to fit intersection')
            elif task=='P21':
                container=captured.get('container')
                if container is not None:
                    cv2.rectangle(frame,point((container.x0,container.y0)),point((container.x1,container.y1)),COLORS[2],2)
                    level=liquid.surface_by_tint(original,container)
                    record['container']=[container.x0,container.y0,container.x1,container.y1]
                    if level is not None:
                        line(frame,(level.x0,level.y_at(level.x0)),(level.x1,level.y_at(level.x1)),COLORS[0],3)
                        record['waterline']={'x0':level.x0,'x1':level.x1,'y0':level.y_at(level.x0),'y1':level.y_at(level.x1),'rms':level.rms_px}
                        note=f'SAM2 vessel boundary; chroma waterline (RMS {level.rms_px:.2f}px)'
                    else:note='SAM2 vessel boundary; waterline unavailable'
            elif task=='P45':
                tubes=captured.get('tubes',[]);tank=captured.get('container')
                if len(tubes)>=2:
                    narrow,wide=sorted(tubes,key=lambda t:t['bore'])[:2]
                    reservoir=module._reservoir_y(original,tank,narrow,wide) if tank is not None else None
                    tint=module._tinted_levels(original,narrow,wide)
                    readings=[]
                    for i,(name,tube) in enumerate([('narrow',narrow),('wide',wide)]):
                        color=COLORS[i]
                        for x in [tube['x_left'],tube['x_right']]:line(frame,(x,0),(x,clip.h),color,1)
                        top=tint[name] if tint is not None else (module._column_top(original,tube,reservoir) if reservoir is not None else None)
                        if top is not None:line(frame,(tube['x_left']-10,top),(tube['x_right']+10,top),color,3)
                        readings.append(dict(tube=name,bore=tube['bore'],top=top,rise=reservoir-top if top is not None and reservoir is not None else None))
                    if reservoir is not None:line(frame,(0,reservoir),(clip.w,reservoir),COLORS[2],2)
                    record.update(tubes=readings,reservoir=reservoir)
                    note='Tube bores & menisci; '+('reservoir detected' if reservoir is not None else 'reservoir unavailable')
            record=clean(record);frame_records.append(record)
            canvas=np.zeros((height+banner,width,3),np.uint8);canvas[banner:]=frame
            font=cv2.FONT_HERSHEY_SIMPLEX
            cv2.putText(canvas,f'{task}  |  seed {seed}  |  t={index/clip.fps:.2f}s  |  frame {index}',(12,21),font,.48,(245,245,245),1,cv2.LINE_AA)
            cv2.putText(canvas,note,(12,44),font,.43,(210,220,235),1,cv2.LINE_AA)
            cv2.putText(canvas,'V3 extractor visualization | no consistency gate / no leaderboard score',(12,65),font,.37,(160,170,180),1,cv2.LINE_AA)
            process.stdin.write(canvas.tobytes())
        process.stdin.close()
        error=process.stderr.read().decode();code=process.wait()
        if code:raise RuntimeError(error)
    except BaseException:
        process.kill();process.wait();raise
    temp.replace(folder/'annotated.mp4')
    # Preserve original video bytes; it remains the reference for annotation review.
    shutil.copyfile(source,folder/'original.mp4')
    save(debug/'frames.json',dict(fps=fps,frames=frame_records,scope='Same extractor functions applied to preview frames. P14 official measurement uses 80% frame; P21 uses endpoint averages; P45 uses settled tail; these supplementary framewise readings do not alter those metrics.'))
    cv2.imwrite(str(folder/'poster.jpg'),cv2.resize(clip[0],(width,height)))
    url='/' + str(folder.relative_to(ROOT/'public'))
    entry=dict(model=model,task=task,seed=seed,original=f'{url}/original.mp4',annotated=f'{url}/annotated.mp4',poster=f'{url}/poster.jpg',measurement=f'{url}/debug/measurements.json',frames=f'{url}/debug/frames.json',figure=f'{url}/debug/measurement.png' if (debug/'measurement.png').exists() else None,source=source_relative,sourceSha256=source_hash,codeSha256=code_hash,duration=duration,sourceFrames=clip.n,sourceFps=clip.fps,previewFps=fps,availableMetrics=count,definedMetrics=len(metrics),status=status)
    save(entry_path,entry)
    return entry

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package',required=True)
    parser.add_argument('--source',required=True)
    parser.add_argument('--workers',type=int,default=2)
    parser.add_argument('--gpu',default='0')
    parser.add_argument('--limit',type=int)
    parser.add_argument('--task')
    args=parser.parse_args()
    source=Path(args.source);package=Path(args.package)
    output=ROOT/'public/phys-last-exam/videos';output.mkdir(exist_ok=True)
    files=sorted(source.glob('*/gpt/g*_P*_seed*.mp4'))
    if args.task:files=[p for p in files if f'_{args.task}_' in p.name]
    if args.limit:files=files[:args.limit]
    hashes=[digest(Path(__file__))]+[digest(p) for p in sorted((package/'shared/physeval').rglob('*.py'))]
    code_hash=hashlib.sha256(''.join(hashes).encode()).hexdigest()
    jobs=[(str(package),str(source),str(p.relative_to(source)),str(output),code_hash) for p in files]
    entries=[];errors=[]
    with ProcessPoolExecutor(args.workers,initializer=init_worker,initargs=(str(package),args.gpu)) as pool:
        futures={pool.submit(build,j):j[2] for j in jobs}
        for future in as_completed(futures):
            try:
                entry=future.result();entries.append(entry)
                print(f'OK {len(entries)}/{len(jobs)} {entry["model"]} {entry["task"]} {entry["seed"]} {entry["status"]}',flush=True)
            except Exception:
                error=dict(source=futures[future],error=traceback.format_exc());errors.append(error)
                print('ERROR '+json.dumps(error),flush=True)
    entries.sort(key=lambda e:(e['model'],e['task'],e['seed']))
    if errors:save(output/'errors.json',errors)
    if errors:raise RuntimeError(f'{len(errors)} jobs failed; see videos/errors.json. Manifest not replaced.')
    if not args.limit and not args.task:
        assert len(entries)==112 and len({(e['model'],e['task'],e['seed']) for e in entries})==112
        save(ROOT/'public/phys-last-exam/video-gallery.json',dict(generatedAt=datetime.now(timezone.utc).isoformat(),source='all_test_2',mode='ungated_physics_extraction',package='vdmbench2/vdmbench/v3',entries=entries))
    print(f'COMPLETE: {len(entries)} video pairs',flush=True)

if __name__=='__main__':main()
