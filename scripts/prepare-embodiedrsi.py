"""Copy completed online recordings into the self-contained project website.
Run with an environment providing imageio, imageio-ffmpeg, numpy, and Pillow.
No simulator, test seed list, private ledger, or final re-render is read.
"""
import argparse, hashlib, json, shutil
from pathlib import Path
import imageio.v2 as imageio
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/embodied-rsi'

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, x): p.write_text(json.dumps(x, indent=2, ensure_ascii=False) + '\n')

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--source',type=Path,required=True); args=parser.parse_args()
    src=args.source.resolve(); media=OUT/'media'; media.mkdir(parents=True,exist_ok=True)
    (OUT/'data').mkdir(exist_ok=True)
    provenance=[]
    twin=src/'analysis/202609251602_test_trace'
    raw=json.loads((twin/'trace.json').read_text())
    titles=['Initial scene','Read the task','Approach the red block','Descend to grasp','Close and lift','Carry to the center','Place the base','Recover from a stall','Approach the green block','Verify the grasp','Carry above the base','Align the stack','Release and verify']
    segments=[]
    for i,s in enumerate(raw['segments']):
        segments.append({k:s.get(k) for k in ['execution','start','end','code','rationale','stdout','stderr','success','native_steps']})
        segments[-1]['title']=titles[i]
    shutil.copy2(twin/'replay.mp4',media/'robotwin.mp4')
    # A poster from the actual recorded video, without annotations or generated imagery.
    reader=imageio.get_reader(twin/'replay.mp4'); frame=reader.get_data(700); reader.close()
    Image.fromarray(frame).save(media/'robotwin.webp',quality=88)
    Image.fromarray(frame[:240,:320]).resize((640,480)).save(media/'hero.webp',quality=90)
    twin_data={'id':'robotwin','benchmark':'RoboTwin','title':'Stack two blocks','task':raw['task'],'instruction':raw['instruction'],'model':'GPT-6 Astra','phase':'Test','suite':'Debug','video':'/embodied-rsi/media/robotwin.mp4','poster':'/embodied-rsi/media/robotwin.webp','duration':raw['duration'],'executions':raw['executions'],'nativeSteps':raw['native_steps'],'success':raw['success'],'cameras':['Head','Front','Left wrist','Right wrist'],'timelineNote':'Observation frames are held for readability. The 40-second presentation timeline is distinct from simulation and agent wall time. Code and feedback are aligned per execution.','segments':segments}
    write(OUT/'data/robotwin.json',twin_data)
    for p in [twin/'trace.json',twin/'replay.mp4']:
        provenance.append({'source':str(p.relative_to(src)),'sha256':sha(p)})

    scene=src/'runs/debug/202609221821_debug/tasks/RoboCasa_OpenDrawer_r1/test/scene_0001'
    result=json.loads((scene/'result.json').read_text())
    assert result['closed'] and result['valid'] and result['task_completed']
    obs=scene/'workspace/observations'; fps=30; cursor=0; segments=[]
    titles=['Initial scene','Read the task','Inspect the interface','Clear the countertop','Move toward the drawer','Find the handle','Adjust lateral alignment','Approach at grasp height','Position the open jaws','Close on the handle','Verify drawer coupling','Pull the drawer','Complete the opening']
    views=['robot0_agentview_right','robot0_agentview_left','robot0_eye_in_hand']
    def mosaic(frames):
        primary=np.asarray(Image.fromarray(frames[0]).resize((512,512)))
        secondary=np.concatenate(frames[1:],axis=0)
        return np.concatenate([primary,secondary],axis=1)
    writer=imageio.get_writer(media/'robocasa.mp4',fps=fps,codec='libx264',quality=8,ffmpeg_params=['-movflags','+faststart'])
    for index,p in enumerate(sorted(x for x in obs.iterdir() if x.is_dir() and x.name.isdigit())):
        frames=[]
        videos=[p/f'execution_{v}.mp4' for v in views]
        if all(v.exists() for v in videos):
            readers=[imageio.get_reader(v) for v in videos]
            for synced in zip(*readers):frames.append(mosaic(synced))
            for r in readers:r.close()
            for v in videos:provenance.append({'source':str(v.relative_to(src)),'sha256':sha(v)})
        if not frames:frames=[mosaic([np.asarray(Image.open(p/f'current_{v}.png').convert('RGB')) for v in views])]
        # Keep every source frame; slow the 20 fps recording to 10 observation frames/s.
        output_frames=max(30,len(frames)*3) if index else 60
        start=cursor/fps
        for j in range(output_frames):writer.append_data(frames[min(len(frames)-1,j*len(frames)//output_frames)])
        cursor+=output_frames
        code=(p/'code.py').read_text() if (p/'code.py').exists() else ''
        notes=[]
        for line in code.splitlines():
            if line.startswith('#'): notes.append(line.lstrip('# ').strip())
            elif line.strip(): break
        r=json.loads((p/'result.json').read_text()) if (p/'result.json').exists() else {}
        segments.append({'execution':int(p.name),'start':start,'end':cursor/fps,'title':titles[index],'code':code,'rationale':'\n'.join(notes),'stdout':(p/'stdout.txt').read_text() if (p/'stdout.txt').exists() else '', 'stderr':(p/'stderr.txt').read_text() if (p/'stderr.txt').exists() else '', 'success':bool(r.get('success',False)),'native_steps':r.get('native_steps_used',0)})
        if index==8:Image.fromarray(frames[-1]).save(media/'robocasa.webp',quality=88)
        for f in ['code.py','result.json','stdout.txt','stderr.txt']:
            if (p/f).exists():provenance.append({'source':str((p/f).relative_to(src)),'sha256':sha(p/f)})
    writer.close()
    task=json.loads((obs/'000000/observation.json').read_text())['annotation.human.task_description']
    casa_data={'id':'robocasa','benchmark':'RoboCasa','title':'Open the right drawer','task':'OpenDrawer','instruction':task,'model':'GPT-6 Astra','phase':'Test','suite':'Debug','video':'/embodied-rsi/media/robocasa.mp4','poster':'/embodied-rsi/media/robocasa.webp','duration':cursor/fps,'executions':result['executions_used'],'nativeSteps':result['native_steps_used'],'success':result['task_completed'],'cameras':['Right view (large)','Left view (top)','Wrist view (bottom)'],'timelineNote':'All available online video frames are retained, with brief holds for observation-only executions. Playback is slowed for reading; code and feedback are aligned per execution.','segments':segments}
    write(OUT/'data/robocasa.json',casa_data)
    (ROOT/'.work/embodiedrsi').mkdir(parents=True,exist_ok=True)
    write(ROOT/'.work/embodiedrsi/asset-provenance.json',provenance)
    print(json.dumps({'robotwin_seconds':raw['duration'],'robocasa_seconds':cursor/fps,'provenance_files':len(provenance),'output':str(OUT)}))
if __name__=='__main__':main()
