"""Visualize current evaluator detections; never reuse a historical video's geometry."""
import argparse,sys,json,importlib,importlib.util
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--package',type=Path,required=True)
parser.add_argument('--task',choices=['P19','P25','P37'],required=True)
parser.add_argument('--video',type=Path,required=True)
parser.add_argument('--evaluation',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[2];task=args.task;pkg=args.package.resolve()
spec={'P19':'medium/P19','P25':'hard/P25','P37':'easy/P37'}[task]
sys.path.insert(0,str(pkg/spec/'evaluator/utils'))
from physeval import read_clip,liquid
module=importlib.import_module('physeval.tasks.'+task.lower())
spec=importlib.util.spec_from_file_location('canvas',root/'scripts/phys-last-exam/evaluator-patches/debug_video.py');canvas=importlib.util.module_from_spec(spec);spec.loader.exec_module(canvas)
directory=args.evaluation.resolve();debug=directory/'debug'
video=args.video.resolve()
clip=read_clip(str(video));raw=json.loads((debug/'raw_result.json').read_text());scene=raw.get('scene',raw.get('verbose',{}).get('scene',{}))
cont=None;masks=None;initialization=None;geometry=None
if (directory/'initialization.json').exists():
 initialization=json.loads((directory/'initialization.json').read_text())
 if task=='P19':
  from physeval.tasks import observed_shadows
  initialization=observed_shadows.load_initialization(directory/'initialization.json',clip)
 elif task=='P37':
  from physeval.tasks import clear_liquid
  geometry=clear_liquid.parse_annotation(clip,initialization) if scene.get('geometry_annotation') else None

if task=='P25':
 cont=liquid.find_container_by_walls(clip[0])
 if cont is None:cont=liquid.find_container(clip[0])
 if (debug/'ice/ice_masks.npz').exists():masks=np.load(debug/'ice/ice_masks.npz')['masks']

def draw(c,i):
 frame=clip[i]
 if task=='P19':
  if initialization:
   tracked=observed_shadows.track_feet(clip.frames[:i+1],initialization['objects'])
   rods,_=observed_shadows.relocate_rods(clip[0],frame,initialization['objects'],tracked)
   if len(rods)<module.MIN_LINES:
    found,_=observed_shadows.relocate_pedestals(frame,len(initialization['objects']))
    if len(found)>=module.MIN_LINES:rods=found
   shadows,_=observed_shadows.shadow_rays(frame,rods)
   for rod in rods:
    x,y,xe,ye=rod['bbox'];c.rect((x,y),(xe,ye),'tracked rod')
  else:shadows=module._shadow_rays(frame)
  point=None
  if len(shadows)>=module.MIN_LINES:point,_=module._common_point([(np.array([s['cx'],s['cy']]),s['axis']) for s in shadows])
  for k,s in enumerate(shadows):
   center=np.array([s['cx'],s['cy']]);color=canvas.COLORS[k%4]
   c.line(center-s['axis']*s['half_len'],center+s['axis']*s['half_len'],'observed shadow axis',color)
   c.circle(s.get('rod_foot_xy',center),4,'rod foot',color)
   if point is not None:c.line(center,point,'intersection fit',color)
 elif task=='P25':
  if cont is not None:
   c.rect((cont.x0,cont.y0),(cont.x1,cont.y1),'vessel ROI')
   xa,xb=cont.interior(.04);excluded=np.ones(frame.shape[1],bool);band=max(6,int(.18*(xb-xa)));excluded[xa:xa+band]=False;excluded[xb-band:xb]=False
   wl=liquid.surface_by_tint(frame,cont,exclude_cols=excluded)
   if wl is not None:c.line((wl.x0,wl.y_at(wl.x0)),(wl.x1,wl.y_at(wl.x1)),'detected surface candidate',canvas.COLORS[1])
  if masks is not None:c.mask(masks[i],f'ice area {int(masks[i].sum())} px')
 elif task=='P37':
  narrow,wide=sorted(clear_liquid.tubes_from_geometry(geometry),key=lambda t:t['bore']) if geometry else (scene.get('narrow_tube'),scene.get('wide_tube'))
  if narrow and wide:
   surface,levels,_=clear_liquid.observe(frame,geometry,narrow,wide) if geometry else (module._shared_reservoir_surface(frame,narrow,wide),None,None)
   if not geometry:levels=module._tinted_levels(frame,narrow,wide) if surface else None
   for k,(name,tube) in enumerate([('narrow',narrow),('wide',wide)]):
    color=canvas.COLORS[k]
    for x in [tube['x_left'],tube['x_right']]:c.line((x,0),(x,clip.h-1),name+' bore wall',color)
    if surface and levels:
     cx=(tube['x_left']+tube['x_right'])/2;y=levels[name];base=surface['slope']*cx+surface['intercept']
     c.line((tube['x_left'],y),(tube['x_right'],y),'meniscus',color);c.line((cx,y),(cx,base),f'rise {base-y:.1f}px',color)
   if surface:c.line((0,surface['intercept']),(clip.w-1,surface['slope']*(clip.w-1)+surface['intercept']),'shared reservoir surface',canvas.COLORS[2])
canvas.write_video(clip.frames,clip.fps,debug,task,draw,'Fresh evaluator output and its detector functions applied to the same newly generated video. Framewise locations are diagnostic; benchmark scores unchanged.')
print('RENDERED',task,video.name)
