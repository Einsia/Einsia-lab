"""Isolated adapter for the supplied task backends; no scoring gate or rule changes."""
import argparse, importlib, json, os, runpy, sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--package',required=True);p.add_argument('--task',required=True);p.add_argument('--video',required=True);p.add_argument('--output',required=True);p.add_argument('--model',required=True);p.add_argument('--seed',type=int,required=True);p.add_argument('--assets');p.add_argument('--source-root');p.add_argument('--code-hash');p.add_argument('--localization',action='store_true');args=p.parse_args()
root=Path(args.package);task=next(root.glob(f'g*/{args.task}'));out=Path(args.output);debug=out.parent;sys.path.insert(0,str(root))
os.environ.setdefault('OMP_NUM_THREADS','2');os.environ.setdefault('EVALUATOR_TORCH_THREADS','2')
import cv2
cv2.setNumThreads(2)
if args.task in ['P8a','P14','P21','P45'] and args.assets and not args.localization:
 import importlib.util
 spec=importlib.util.spec_from_file_location('video_builder',Path(__file__).with_name('build-video-gallery.py'))
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 module.init_worker(args.package,'0')
 entry=module.build((args.package,args.source_root,str(Path(args.video).relative_to(args.source_root)),args.assets,args.code_hash))
 entry.update(annotationKind='framewise_preview',reason='')
 module.save(Path(args.output).parents[1]/'entry.json',entry)
 sys.exit(0)
if task.parent.name in ['g1','g4','g6']:
 import torch
 from shared.physeval import Context,get_evaluator,read_clip
 from shared.physeval import liquid
 original=liquid.segment
 def find(*a,**k):
  with torch.autocast('cuda',dtype=torch.bfloat16,enabled=torch.cuda.is_available()):return original(*a,**k)
 liquid.segment=find
 ctx=Context(task_id=args.task,video_path=args.video,image_path=str(task/'first_frame.png'),video_prompt=(task/'prompts/video.txt').read_text(),model=args.model,seed=args.seed,debug_path=str(debug/'measurement.png'))
 result=get_evaluator(args.task)(read_clip(args.video),ctx)
 result.write(out)
elif task.parent.name=='g7':
 from shared.physeval import read_clip
 modules={'P7':'p7_rotational','P8c':'p8c_pendulum','P10':'p10_mechanics','P12':'p12_optics','P27':'p27_thermal'}
 mod=importlib.import_module(f'g7.{args.task}.evaluator.{modules[args.task]}')
 clip=read_clip(args.video)
 result=mod.evaluate(clip.frames,clip.fps,str(debug),sample_id=Path(args.video).stem)
 def clean(x):
  import numpy as np
  if isinstance(x,dict):return {str(k):clean(v) for k,v in x.items()}
  if isinstance(x,(list,tuple)):return [clean(v) for v in x]
  if isinstance(x,np.ndarray):return clean(x.tolist())
  if isinstance(x,np.generic):return clean(x.item())
  return x
 out.write_text(json.dumps(clean(result),ensure_ascii=False,indent=2))
else:
 from unified_evaluators.runtime import backend_command, digest
 row={'video_path':args.video,'image_path':str(task/'first_frame.png'),'sample_id':Path(args.video).stem,'model':args.model,'seed':args.seed,'route':'gpt','video_sha256':digest(args.video)}
 prompt=task/'prompts/video.txt'
 row['video_prompt']=prompt.read_text() if prompt.exists() else ''
 command=backend_command(task,row,out,debug,[])
 sys.path.insert(0,str(task/'evaluator'))
 sys.argv=command[1:]
 runpy.run_path(command[1],run_name='__main__')
