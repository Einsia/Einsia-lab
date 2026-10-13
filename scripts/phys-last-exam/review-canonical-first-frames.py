"""Install reviewed initialization for current P3/P9 video first frames.
Coordinates identify input objects only; no trajectories or scores are annotated.
All 64 video initializations must pass independent colored-object correspondence.
"""
import argparse,hashlib,json
from pathlib import Path
import cv2,numpy as np,yaml
p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--source',type=Path,required=True);a=p.parse_args()
def detect(frame,color):
 hsv=cv2.cvtColor(frame,cv2.COLOR_BGR2HSV);h,s,v=cv2.split(hsv)
 mask=(((h<12)|(h>165)) if color=='red' else ((h>90)&(h<130)))&(s>100)&(v>60)
 n,labels,stats,centers=cv2.connectedComponentsWithStats(mask.astype('uint8'))
 candidates=[k for k in range(1,n) if stats[k,4]>30]
 if not candidates:raise ValueError('No '+color+' object detected')
 k=max(candidates,key=lambda k:stats[k,4]);return centers[k].tolist(),float(np.sqrt(stats[k,4]/np.pi))
for task in ['P3','P9']:
 taskdir=a.package/'g3'/task;dest=taskdir/'canonical_inputs';dest.mkdir(exist_ok=True)
 source=next((a.source/'minimax-h3/gpt').glob('*_'+task+'_seed42.mp4'));cap=cv2.VideoCapture(str(source));ok,frame=cap.read();cap.release();assert ok
 frame=cv2.resize(frame,(1344,768));cv2.imwrite(str(dest/'all_test_first_frame.png'),frame)
 red,rr=detect(frame,'red');blue,br=detect(frame,'blue');cfgpath=taskdir/'evaluator/config.yaml';cfg=yaml.safe_load(cfgpath.read_text());key=task+'_gpt_current'
 if task=='P3':
  sample={'method':'gpt','first_frame':str(dest/'all_test_first_frame.png'),'balls':{'upper':{'cx':blue[0],'cy':blue[1],'radius':br,'angle_deg':60.0},'lower':{'cx':red[0],'cy':red[1],'radius':rr,'angle_deg':30.0}}}
 else:
  sample={'first_frame':str(dest/'all_test_first_frame.png'),'short':{'pivot':[449.,90.],'bob':red,'radius':rr},'long':{'pivot':[880.,90.],'bob':blue,'radius':br}}
 cfg['samples'][key]=sample
 record={'source_id':key,'first_frame':str(dest/'all_test_first_frame.png'),'first_frame_sha256':hashlib.sha256((dest/'all_test_first_frame.png').read_bytes()).hexdigest(),'coordinate_size':[1344,768],'initial_landmarks':{'red':red,'blue':blue},'review':'Current all_test decoded first frame reviewed visually. P3 upper blue/lower red; P9 short red/long blue with support-string attachment pivots. Centers/radii extracted from input pixels. No output trajectories or score annotations.','reference_video_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
 checks=[]
 for f in sorted(a.source.glob('*/gpt/*_'+task+'_seed*.mp4')):
  cap=cv2.VideoCapture(str(f));ok,actual=cap.read();cap.release();assert ok
  actual=cv2.resize(actual,(1344,768));errors={color:float(np.linalg.norm(np.array(detect(actual,color)[0])-record['initial_landmarks'][color])) for color in ['red','blue']}
  assert max(errors.values())<20,(f,errors)
  checks.append({'video':str(f.relative_to(a.source)),'videoSha256':hashlib.sha256(f.read_bytes()).hexdigest(),'landmarkErrorsPx':errors})
 cfg['canonical_inputs']['g3_'+task]=record;cfgpath.write_text(yaml.safe_dump(cfg,sort_keys=False,allow_unicode=True));(dest/'review.json').write_text(json.dumps({'initialization':record,'videoChecks':checks},indent=2)+'\n');print(task,len(checks),'initial frame correspondence checks passed')
