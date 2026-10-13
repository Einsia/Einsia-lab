"""Materialize visually reviewed frame-zero initialization, never rollout evidence.

Review contact sheets first. A review file pins the exact candidate and video
hashes; this script cannot silently approve another dataset or new candidates.
"""
import argparse, hashlib, json
from pathlib import Path
import av
import cv2
import numpy as np

def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--review', type=Path, required=True)
    args = p.parse_args()
    review = json.loads(args.review.read_text())
    for item in review['samples']:
        candidate = Path(item['candidate'])
        assert digest(candidate) == item['candidateSha256']
        a = json.loads(candidate.read_text())
        source = Path(a['source_video'])
        assert digest(source) == item['sourceSha256'] == a['source_video_sha256']
        with av.open(str(source)) as container:
            frame = next(container.decode(video=0)).to_ndarray(format='bgr24')
        h, w = frame.shape[:2]
        assert [w, h] == a['size_wh']
        modifications = []
        if a['task_id'] == 'P38':
            # The reviewed plates are copper, including slightly displaced
            # Lingbot plates. Fit initialization to observed frame-zero pixels.
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            copper = ((hsv[:,:,0] > 3) & (hsv[:,:,0] < 30) & (hsv[:,:,1] > 65)).astype('uint8')
            for obj in a['objects']:
                old = list(obj['box']); x1,y1,x2,y2 = old
                pad = max(12, round(25*w/1344))
                roi = np.zeros((h,w),np.uint8)
                roi[max(0,y1-pad):min(h,y2+pad),max(0,x1-pad):min(w,x2+pad)] = 1
                n, labels, stats, _ = cv2.connectedComponentsWithStats(copper & roi)
                k = 1 + np.argmax(stats[1:,cv2.CC_STAT_AREA])
                x,y,bw,bh,area = stats[k]
                assert area > (x2-x1)*(y2-y1)*.15
                obj['box'] = [max(0,int(x)-2),max(0,int(y)-2),min(w,int(x+bw)+2),min(h,int(y+bh)+2)]
                yy,xx = np.where(cv2.erode((labels==k).astype('uint8'),np.ones((3,3),np.uint8)))
                assert len(xx)>10
                points = np.column_stack([xx,yy])
                obj['positive'] = [points[np.argmin(((points-pt)**2).sum(1))].tolist() for pt in obj['positive']]
                # Preserve only negative hints that remain background in this frame.
                obj['negative'] = [pt for pt in obj.get('negative',[]) if not copper[pt[1],pt[0]]]
                modifications.append({'object':obj['name'],'old_box':old,'new_box':obj['box'],'method':'observed copper component within reviewed object ROI'})
        out = candidate.parent.parent/'annotations'
        out.mkdir(exist_ok=True)
        still = out/(candidate.stem+'.png')
        cv2.imwrite(str(still),frame)
        a.update(source_image_sha256=digest(still), source_image=str(still),
                 annotation_type='agent_reviewed_decoded_frame0',
                 visual_review={'review_file':str(args.review.resolve()),'review_sha256':digest(args.review),
                                'scope':'Actual frame-zero object identities, prompt points, boxes and task geometry; no motion or scores reused.'},
                 initialization_adjustments=modifications)
        a['review']='Actual decoded frame zero reviewed; task-template geometry registered by canvas dimensions; P38 material hints fitted to visible copper.'
        (out/candidate.name).write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
        canvas=frame.copy()
        for obj in a['objects']:
            x1,y1,x2,y2=obj['box'];cv2.rectangle(canvas,(x1,y1),(x2,y2),(0,255,0),2)
            for pt in obj['positive']:cv2.circle(canvas,tuple(pt),3,(0,255,0),-1)
            cv2.putText(canvas,obj['name'],(x1,max(20,y1-6)),0,.55,(0,255,0),1)
        cv2.imwrite(str(out/(candidate.stem+'-review.png')),canvas)
    print('Prepared',len(review['samples']),'hash-bound initializations')

if __name__=='__main__':main()
