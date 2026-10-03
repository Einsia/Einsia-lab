"""Resolve local weights and adapt canonical GPT filenames with verified geometry."""
import argparse,hashlib,json,sys
from pathlib import Path
import yaml
p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--checkpoints',type=Path,required=True);a=p.parse_args();root=a.package
legacy=Path('/mnt/einsia/aws01-nvme/einsia-shared/homes/gaomingju/workspace')
assets={'sam2_hf':str(a.checkpoints/'SAM2.1-hiera-large'),'sam2_checkpoint':str(a.checkpoints/'SAM2.1-hiera-large/sam2.1_hiera_large.pt'),'sam2_config':'configs/sam2.1/sam2.1_hiera_l.yaml','sam2_vendor':str(legacy/'evaluator/videos_all/v3/g8/P34/vendor/sam2'),'cotracker_source':str(legacy/'physical-bench/cache/cotracker'),'cotracker_checkpoint':str(legacy/'evaluator/shared_models/cotracker3/scaled_offline.pth'),'dino_model':str(legacy/'evaluator/videos_all/v3/g8/P34/models/grounding-dino-tiny')}
for k,v in assets.items():
 if k!='sam2_config':assert Path(v).exists(),(k,v)
(root/'local_resources.json').write_text(json.dumps(assets,indent=2)+'\n')
# Explicit aliases are bound to the reviewed task input hash; seeds retain identity.
for task in ['P3','P6','P9']:
 directory=root/'g3'/task;path=directory/'evaluator'/('config_v1.yaml' if task=='P6' else 'config.yaml');cfg=yaml.safe_load(path.read_text())
 cfg.setdefault('canonical_inputs', {'g3_'+task:{'source_id':task+'_gpt_01_modern','first_frame':str(directory/'first_frame.png'),'first_frame_sha256':hashlib.sha256((directory/'first_frame.png').read_bytes()).hexdigest(),'coordinate_size':[1344,768],'review':'Verified standard task image geometry against gpt_01_modern frozen initialization.'}})
 if task!='P6':
  runtime=cfg['runtime'];runtime['cotracker_source']=assets['cotracker_source'];runtime['cotracker_checkpoint']=assets['cotracker_checkpoint']
  runtime['tracking_python' if task=='P3' else 'python_track']=sys.executable
  runtime['sam2_snapshot' if task=='P3' else 'sam2_path']=assets['sam2_hf'];runtime['default_device']='0' if task=='P3' else 'cuda:0'
 path.write_text(yaml.safe_dump(cfg,sort_keys=False,allow_unicode=True))
helper=root/'shared/canonical_inputs.py'
helper.write_text('''"""Explicit, image-hash-bound mapping for canonical video names."""
import copy,hashlib,re
from pathlib import Path

def resolve(stem,cfg):
    key=re.sub(r'_seed\\d+$','',stem)
    record=cfg.get('canonical_inputs',{}).get(key)
    if record is None:return key,None
    if hashlib.sha256(Path(record['first_frame']).read_bytes()).hexdigest()!=record['first_frame_sha256']:
        raise ValueError('Canonical first-frame input changed; review mapping before reuse')
    return record['source_id'],record

def scaled(sample,record,width,height,task,first_frame=None):
    if record is None:return sample
    sample=copy.deepcopy(sample);rw,rh=record['coordinate_size'];sx,sy=width/rw,height/rh
    if record.get('initial_landmarks') and first_frame is not None:
        import cv2,numpy as np
        hsv=cv2.cvtColor(cv2.resize(first_frame,(rw,rh)),cv2.COLOR_RGB2HSV);h,s,v=cv2.split(hsv)
        for color,expected in record['initial_landmarks'].items():
            mask=(((h<12)|(h>165)) if color=='red' else ((h>90)&(h<130)))&(s>100)&(v>60)
            n,labels,stats,centers=cv2.connectedComponentsWithStats(mask.astype('uint8'))
            hits=[k for k in range(1,n) if stats[k,4]>30]
            if not hits or np.linalg.norm(centers[max(hits,key=lambda k:stats[k,4])]-expected)>20:
                raise ValueError('Current video initial geometry differs from reviewed canonical initialization')
    if task=='P3':
        for ball in sample['balls'].values():
            ball['cx']*=sx;ball['cy']*=sy;ball['radius']*=(sx+sy)/2
    elif task=='P9':
        for slot in ['short','long']:
            for key in ['bob','pivot']:sample[slot][key]=[sample[slot][key][0]*sx,sample[slot][key][1]*sy]
            sample[slot]['radius']*=(sx+sy)/2
    return sample
''')
for task in ['P3','P6','P9']:
 path=root/'g3'/task/'evaluator/evaluate_raw_legacy.py';s=path.read_text()
 if 'from shared.canonical_inputs import' not in s:
  # Insert after HERE, where future imports have already completed.
  line='HERE = Path(__file__).resolve().parent' if 'HERE = Path(__file__).resolve().parent' in s else 'from pathlib import Path'
  pos=s.index(line)+len(line)
  s=s[:pos]+"\nimport sys\n_V3_INPUT_ROOT = str(Path(__file__).resolve().parents[3])\nif _V3_INPUT_ROOT not in sys.path: sys.path.insert(0, _V3_INPUT_ROOT)\nfrom shared.canonical_inputs import resolve as resolve_input, scaled as scale_input\n"+s[pos:]
  if task=='P3':
   s=s.replace('sample_id, seed_number = sample_id_from_video(video)','sample_id, seed_number = sample_id_from_video(video)\n    sample_id, canonical_input = resolve_input(video.stem, cfg)')
   s=s.replace('frames, timestamps, fps, video_meta = read_video(video)','frames, timestamps, fps, video_meta = read_video(video)\n    sample_cfg = scale_input(sample_cfg, canonical_input, frames.shape[2], frames.shape[1], "P3")')
  elif task=='P9':
   s=s.replace('sample=sample_id_from_name(video.stem)','sample, canonical_input=resolve_input(video.stem,cfg)')
   s=s.replace("frames,times=decode_video(video);", "frames,times=decode_video(video); cfg['samples'][sample]=scale_input(cfg['samples'][sample],canonical_input,frames.shape[2],frames.shape[1],'P9');")
  else:s=s.replace('source_id = infer_source_id(video, config["sources"])','source_id, canonical_input = resolve_input(video.stem, config)\n    if canonical_input is None: source_id = infer_source_id(video, config["sources"])')
  path.write_text(s)
for task in ['P3','P9']:
 path=root/'g3'/task/'evaluator/evaluate_raw_legacy.py';s=path.read_text()
 s=s.replace('frames.shape[1], "P3")','frames.shape[1], "P3", frames[0])').replace("frames.shape[1],'P9')","frames.shape[1],'P9',frames[0])")
 path.write_text(s)
# Refined evaluators resolve actual assets before decoding/annotation validation.
p=root/'refined_evaluators/runtime.py';s=p.read_text()
if 'local_resources.json' not in s:
 s=s.replace("args=p.parse_args()", "args=p.parse_args()") # actual parse location handled below
 marker="        for key in ['sam2_checkpoint','cotracker_checkpoint']:"
 addition="""        resource_file=ROOT/'local_resources.json'
        if resource_file.exists():
            local=json.loads(resource_file.read_text())
            for key in ['sam2_checkpoint','cotracker_checkpoint','dino_model']:
                if not Path(getattr(args,key)).exists():
                    setattr(args,key,local[key])
                    if key=='sam2_checkpoint':args.sam2_config=local['sam2_config']
            for key in ['sam2_vendor','cotracker_source']:
                if local[key] not in sys.path:sys.path.insert(0,local[key])
            # The shipped reviewed annotation is usable only on identical video bytes.
            if not args.annotation:
                from .media import fingerprint
                annotation=next(ROOT.glob('g*/'+task))/'annotations/first_frame_annotations.json'
                if annotation.exists() and json.loads(annotation.read_text()).get('source_video_sha256')==fingerprint(args.video_path):args.annotation=str(annotation)
"""
 s=s.replace(marker,addition+marker);p.write_text(s)
p=root/'g3/P3/evaluator/evaluate_raw_legacy.py';s=p.read_text().replace('result["scores"]["end_to_end"]','result["scores"].get("overall", result["scores"].get("end_to_end"))');p.write_text(s)

# Guard P9 tracking reuse by video/config hash, not just the cache filename.
p=root/'g3/P9/evaluator/evaluate_raw_legacy.py';s=p.read_text()
if 'cache_signature' not in s:
 s=s.replace("    if a.force_tracking or not cache.exists():", "    import hashlib\n    signature={'video':hashlib.sha256(video.read_bytes()).hexdigest(),'config':hashlib.sha256(Path(a.config).read_bytes()).hexdigest()}\n    signature_file=debug/'tracks_signature.json'\n    cache_signature=json.loads(signature_file.read_text()) if signature_file.exists() else None\n    if a.force_tracking or not cache.exists() or cache_signature!=signature:")
 s=s.replace("    data=np.load(cache,allow_pickle=False);", "    signature_file.write_text(json.dumps(signature))\n    data=np.load(cache,allow_pickle=False);")
 p.write_text(s)
p=root/'refined_evaluators/runtime.py';s=p.read_text().replace("'SAM2.1 Hiera Small; actual pixel masks and documented color refinement'", "f'SAM2 ({Path(args.sam2_checkpoint).name}); actual pixel masks and documented color refinement'");p.write_text(s)

print('Adapted P3/P6/P9 canonical inputs and local refined-task model paths.')
