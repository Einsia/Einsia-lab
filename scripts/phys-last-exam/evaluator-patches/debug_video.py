"""Framewise localization debug media, using the evaluator's own evidence.

Like G2's draw_debug, marks detections on their corresponding decoded frame.
It does not alter metrics, interpolate missing detections, or draw future tracks.
Additional framewise liquid/shadow/optical readings are visualization-only.
"""
from pathlib import Path
import importlib
import json
import math
import subprocess
import cv2
import numpy as np

COLORS = [(40,210,255),(255,180,60),(100,230,100),(210,100,230)]

def finite(x):
    try:return bool(np.isfinite(np.asarray(x,dtype=float)).all())
    except (TypeError,ValueError):return False

def clean(x):
    if isinstance(x,dict):return {str(k):clean(v) for k,v in x.items()}
    if isinstance(x,(list,tuple,np.ndarray)):return [clean(v) for v in x]
    if isinstance(x,np.generic):return clean(x.item())
    if isinstance(x,float) and not math.isfinite(x):return None
    return x

class Canvas:
    def __init__(self,frame):self.frame=frame.copy();self.items=[]
    def pt(self,p):return tuple(int(np.clip(round(v),-100000,100000)) for v in p)
    def label(self,p,label,color):
        if finite(p):cv2.putText(self.frame,str(label),(max(2,self.pt(p)[0]+7),max(18,self.pt(p)[1]-8)),0,.48,color,1,cv2.LINE_AA)
    def line(self,a,b,label='',color=COLORS[0]):
        if not finite([a,b]):return
        cv2.line(self.frame,self.pt(a),self.pt(b),color,2,cv2.LINE_AA)
        self.items.append(dict(kind='line',a=a,b=b,label=label));self.label(a,label,color)
    def circle(self,p,r,label='',color=COLORS[0]):
        if not finite([*p,r]) or r<=0:return
        cv2.circle(self.frame,self.pt(p),int(min(max(self.frame.shape[:2]),max(3,r))),color,2,cv2.LINE_AA)
        cv2.drawMarker(self.frame,self.pt(p),color,cv2.MARKER_CROSS,9,1)
        self.items.append(dict(kind='circle',center=p,radius=r,label=label));self.label(p,label,color)
    def rect(self,a,b,label='',color=COLORS[2]):
        if not finite([a,b]):return
        cv2.rectangle(self.frame,self.pt(a),self.pt(b),color,2)
        self.items.append(dict(kind='box',a=a,b=b,label=label));self.label(a,label,color)
    def mask(self,mask,label,color=COLORS[0],offset=(0,0)):
        if mask is None:return
        contours,_=cv2.findContours(np.asarray(mask,dtype=np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            if cv2.contourArea(contour)<4:continue
            contour=cv2.approxPolyDP(contour,1.5,True)+np.array(offset).reshape(1,1,2)
            cv2.drawContours(self.frame,[contour.astype(np.int32)],-1,color,2)
            self.items.append(dict(kind='contour',points=contour.reshape(-1,2),label=label))
        if contours:self.label(np.asarray(contours[0]).reshape(-1,2)[0]+offset,label,color)
    def track(self,xy,index,label,radius=6,color=COLORS[0],pivot=None):
        xy=np.asarray(xy,float)
        if index>=len(xy):return
        # Never join over a missing observation.
        for j in range(max(1,index-24),index+1):
            if finite(xy[j-1:j+1]):cv2.line(self.frame,self.pt(xy[j-1]),self.pt(xy[j]),color,1,cv2.LINE_AA)
        if finite(xy[index]):
            self.circle(xy[index],radius,label,color)
            if pivot is not None:self.line(pivot,xy[index],'pivot / length',color)


def write_video(frames,fps,directory,task,draw,scope):
    if not len(frames):return None
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    path=directory/'localization.mp4';temporary=directory/'localization.tmp.mp4'
    h,w=frames[0].shape[:2];width=min(960,w)//2*2;height=int(h*width/w)//2*2;banner=66
    rate=min(8.0,float(fps));records=[]
    cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{width}x{height+banner}','-r',str(rate),'-i','pipe:0','-an','-c:v','libx264','-threads','1','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(temporary)]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for j in range(math.ceil(len(frames)/fps*rate)):
            index=min(len(frames)-1,int(j*fps/rate));c=Canvas(frames[index]);draw(c,index)
            record=dict(sourceFrame=index,time=index/fps,coordinateSize=[w,h],features=c.items)
            records.append(clean(record))
            canvas=np.zeros((height+banner,width,3),np.uint8);canvas[banner:]=cv2.resize(c.frame,(width,height))
            cv2.putText(canvas,f'{task} | frame {index} | {index/fps:.2f}s | detection & measurement localization',(12,20),0,.46,(245,245,245),1,cv2.LINE_AA)
            text='Detected geometry: '+', '.join(dict.fromkeys(str(x['label']) for x in c.items if x.get('label'))) if c.items else 'No reliable measurement geometry detected in this frame'
            cv2.putText(canvas,text[:115],(12,40),0,.39,(120,230,255) if c.items else (100,170,255),1,cv2.LINE_AA)
            cv2.putText(canvas,'Detected / fitted locations only; missing detections are not filled. No new score.',(12,58),0,.36,(170,180,190),1,cv2.LINE_AA)
            process.stdin.write(canvas.tobytes())
        process.stdin.close();error=process.stderr.read().decode();code=process.wait()
        if code:raise RuntimeError(error)
        temporary.replace(path)
    except BaseException:
        process.kill();process.wait();raise
    (directory/'localization.json').write_text(json.dumps(dict(task=task,sourceFps=fps,previewFps=rate,sourceFrames=len(frames),scope=scope,frames=records),ensure_ascii=False,allow_nan=False)+'\n')
    return str(path)


def finish_shared(result,clip,ctx,e):
    if not ctx.debug_path:return result
    from . import liquid
    module=importlib.import_module('.tasks.'+ctx.task_id.lower(),__package__)
    task=ctx.task_id
    def draw(c,i):
        tracks=[]
        if task in ['P1','P2','P18'] and e.get('tr') is not None:
            tr=e['tr'];tracks=[(tr,'ball',None)]
        elif task=='P5':tracks=[(e[k],k+' ball',None) for k in ['left','right'] if e.get(k) is not None]
        elif task in ['P8a','P8b']:
            tracks=[(b.track,'bob '+str(k+1),b.pivot) for k,b in enumerate(e.get('bobs',[]))]
        elif task=='P16':tracks=[(tr,'marker '+str(k+1),None) for k,tr in enumerate(e.get('tracks',[]))]
        for k,(tr,label,pivot) in enumerate(tracks):
            radius=tr.r[i] if i<len(tr.r) and finite(tr.r[i]) else 6
            c.track(np.column_stack([tr.x,tr.y]),i,label,radius,COLORS[k%4],pivot)
        if task=='P16' and len(tracks)>=2:
            points=[(tr.x[i],tr.y[i]) for tr,_,_ in tracks]
            if finite(points):c.line(points[0],points[-1],'marker axis',COLORS[2])
        if task=='P2' and e.get('tr') is not None and all(k in e for k in ['a0','start','apex','land']):
            tr=e['tr'];start=e['a0']+e['start'];apex=e['a0']+e['apex'];land=e['a0']+e['land']
            if max(start,apex,land)<clip.n:
                if i>=apex:c.line((tr.x[apex],tr.y[start]),(tr.x[apex],tr.y[apex]),'height H',COLORS[2])
                if i>=land:c.line((tr.x[start],tr.y[start]),(tr.x[land],tr.y[start]),'range R',COLORS[1])
        if task=='P48':
            for k,b in enumerate(e.get('blobs',[[]]*clip.n)[i]):
                c.circle((b['cx'],b['cy']),b['radius'],f'drop {k+1}: r={b["radius"]:.1f}px',COLORS[k%4])
                c.mask(cv2.drawContours(np.zeros((clip.h,clip.w),np.uint8),[b['contour']],-1,1,-1),'drop boundary',COLORS[k%4])
        cont=e.get('cont',e.get('tank'))
        if cont is not None:
            c.rect((cont.x0,cont.y0),(cont.x1,cont.y1),'fixed vessel ROI')
        if task in ['P18','P20','P21'] and cont is not None:
            frame=clip[i];ice=None
            if task=='P20':
                ice=liquid.find_floating_block(frame,cont)
                c.mask(ice,'ice segmentation')
                wl=liquid.find_waterline(frame,cont,exclude_cols=liquid.columns_of(ice),search=(.02,.75)) if ice is not None else None
            else:wl=liquid.surface_by_tint(frame,cont) if task=='P21' else liquid.find_waterline(frame,cont)
            if wl is not None:
                c.line((wl.x0,wl.y_at(wl.x0)),(wl.x1,wl.y_at(wl.x1)),'waterline',COLORS[1])
                if ice is not None:
                    ys,xs=np.nonzero(ice);x=float(np.median(xs));top=float(ys.min());bottom=float(ys.max());surface=wl.y_at(x)
                    c.line((x,top),(x,bottom),f'height={bottom-top:.1f}px')
                    c.line((x+12,surface),(x+12,bottom),f'submerged={bottom-surface:.1f}px',COLORS[2])
        if task=='P14':
            shadows=module._shadow_rays(clip[i]);point=None
            if len(shadows)>=module.MIN_LINES:point,_=module._common_point([(np.array([s['cx'],s['cy']]),s['axis']) for s in shadows])
            for k,s in enumerate(shadows):
                foot=np.array([s['cx'],s['cy']]);c.line(foot,foot+s['axis']*s['half_len'],'shadow ray',COLORS[k%4]);c.circle(foot,5,'rod foot',COLORS[k%4])
                if point is not None:c.line(foot,point,'intersection fit',COLORS[k%4])
        if task=='P45' and len(e.get('tubes',[]))>=2:
            narrow,wide=sorted(e['tubes'],key=lambda t:t['bore'])[:2];tank=e.get('tank')
            reservoir=module._reservoir_y(clip[i],tank,narrow,wide) if tank is not None else None
            tint=module._tinted_levels(clip[i],narrow,wide)
            for k,(name,tube) in enumerate([('narrow',narrow),('wide',wide)]):
                color=COLORS[k]
                for x in [tube['x_left'],tube['x_right']]:c.line((x,0),(x,clip.h-1),name+' wall',color)
                top=tint[name] if tint is not None else module._column_top(clip[i],tube,reservoir) if reservoir is not None else None
                if top is not None:
                    c.line((tube['x_left'],top),(tube['x_right'],top),'meniscus',color)
                    if reservoir is not None:c.line((tube['cx'] if 'cx' in tube else (tube['x_left']+tube['x_right'])/2,top),((tube['x_left']+tube['x_right'])/2,reservoir),f'rise={reservoir-top:.1f}px',color)
            if reservoir is not None:c.line((0,reservoir),(clip.w-1,reservoir),'reservoir',COLORS[2])
    path=write_video(clip.frames,clip.fps,Path(ctx.debug_path).parent,task,draw,'Existing detection/track outputs; liquid/shadow detectors reapplied to preview frames only. Scoring windows and thresholds unchanged.')
    result.debug_video=path
    return result


def finish_g7(result,task,frames,fps,debug_dir,e):
    if debug_dir is None:return result
    work=e.get('work_frames',e.get('materialized',frames))
    def draw(c,i):
        if task in ['P7','P8c']:
            for k,track in enumerate(e.get('raw_tracks',[])):
                radius=e.get('radii',[6]*len(e.get('raw_tracks',[])))[k] if task=='P7' else 6
                pivot=None
                if task=='P8c' and k<len(e.get('angle_fits',[])):
                    fit=e['angle_fits'][k][0]
                    if fit.get('available'):pivot=fit['pivot_xy']
                c.track(track,i,'object '+str(k+1),radius,COLORS[k%4],pivot)
        elif task=='P10':
            ids=e.get('frame_indices',[]);points=e.get('points',[]);xy=np.full((len(work),2),np.nan)
            for j,p in zip(ids,points):xy[int(j)]=p
            c.track(xy,i,'block centroid')
            center=e.get('center');axis=e.get('axis')
            if center is not None and axis is not None:c.line(center-np.asarray(axis)*500,center+np.asarray(axis)*500,'fitted ramp axis',COLORS[2])
        elif task=='P27':
            for k,(side,roi) in enumerate(e.get('rois',{}).items()):
                x,y,w,h=roi;c.rect((x,y),(x+w,y+h),side+' ROI',COLORS[k%4])
                masks=e.get('masks',{}).get(side,[])
                if i<len(masks):c.mask(masks[i],side+' ice mask',COLORS[k%4],(x,y))
        elif task=='P12':
            module=importlib.import_module('g7.P12.evaluator.p12_optics')
            analysis=module.analyze_frame(work[i]);c.frame=analysis.overlay.copy()
            # Machine-readable geometry is exported alongside exactly this overlay.
            c.items.append(dict(kind='optical_analysis',label='rays / interface' if analysis.success else 'partial optical detections',measurements=analysis.measurements,extractSuccess=bool(analysis.success)))
    path=write_video(work,fps,debug_dir,task,draw,'Evaluator raw detections and masks; missing observations are not interpolated. P12 reapplies the same frame analyzer for the preview only.')
    artifacts=result.setdefault('debug_artifacts',{})
    if isinstance(artifacts,dict):artifacts['localization_video']=path
    else:artifacts.append(path)
    return result
