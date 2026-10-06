"""Extract Table 2 values and embedded brand logos from the supplied manuscript.
Requires PyMuPDF locally; CI consumes the committed snapshot.
"""
import hashlib,json,re,shutil
from pathlib import Path
import pymupdf
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'reference/VDM_Bench_Einsia (1).pdf'
if not source.exists(): source=ROOT/'public/phys-last-exam/paper-draft.pdf'
doc=pymupdf.open(source)
page=next(p for p in doc if 'Table 2 Main results' in p.get_text(sort=True));text=page.get_text(sort=True)
models=[('seedance-2.5','Seedance 2.5','#0891b2'),('minimax-h3','MiniMax H3','#e54865'),('cosmos3-super-image2video','Cosmos 3 Super','#65a30d'),('vbvr-wan2.2','VBVR Wan2.2','#b45309'),('wan2.2-i2v-a14b','Wan 2.2-A14B','#7c3aed'),('lingbot-video-moe-30b-a3b','LingBot 30B-A3B','#334155'),('hunyuan-video-1.5-i2v','Hunyuan 1.5','#2563eb'),('cogvideox1.5-5b-i2v','CogVideoX 1.5-5B','#52525b')]
ids=['motion','rolling','oscillations','optics','hydrostatics','thermal','electromagnetism','granular','interfaces']
colors=['#2563eb','#b45309','#7c3aed','#0891b2','#0284c7','#d97706','#be185d','#9a5b32','#0f766e']
categories=[];tasks=[]
for line in text.splitlines():
 m=re.match(r'^([1-9])\.\s+(.+)$',line.strip())
 if m:
  i=int(m[1])-1;categories.append(dict(id=ids[i],name=m[2],color=colors[i]));continue
 m=re.match(r'^(P\d+[a-z]?)\s+(.+?)\s+([EMH])\s+((?:\d+\.\d+\s*[✓✗]\s*){8})$',line.strip())
 if m:
  cells=re.findall(r'(\d+\.\d+)\s*([✓✗])',m[4]);tasks.append(dict(id=m[1],name=m[2].strip(),category=categories[-1]['id'],difficulty={'E':'Easy','M':'Medium','H':'Hard'}[m[3]],scores={model[0]:float(cell[0]) for model,cell in zip(models,cells)},consistency={model[0]:cell[1]=='✓' for model,cell in zip(models,cells)}))
assert len(tasks)==40 and len(categories)==9
means=[float(x) for x in re.search(r'Average score\s+((?:\d+\.\d+\s*){8})',text)[1].split()]
logos=ROOT/'public/phys-last-exam/logos';logos.mkdir(exist_ok=True)
images=sorted(page.get_images(full=True),key=lambda im:page.get_image_rects(im[0])[0].x0)
assert len(images)==8
rows=[]
for (id,name,color),avg,im in zip(models,means,images):
 pix=pymupdf.Pixmap(doc,im[0]);mask=pymupdf.Pixmap(doc,im[1]) if im[1] else None
 if mask:pix=pymupdf.Pixmap(pix,mask)
 pix.save(str(logos/(id+'.png')))
 rows.append(dict(id=id,name=name,color=color,average=avg,logo='/phys-last-exam/logos/'+id+'.png'))
result=dict(source='VDM_Bench_Einsia (1).pdf',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),table=2,page=page.number+1,updated='2026-10-05',scoreNote='Reviewed scores, 0–100; Average score is video-weighted. S = 0.15C + 0.85P × 1(F).',categories=categories,models=rows,tasks=tasks,logoSource='Brand logo images embedded in the supplied manuscript, Table 2; extracted without redrawing.')
(ROOT/'public/phys-last-exam/paper-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if source.resolve() != (ROOT/'public/phys-last-exam/paper-draft.pdf').resolve():
    shutil.copy2(source,ROOT/'public/phys-last-exam/paper-draft.pdf')
# Prefer the vector teaser source; retain a fallback for older paper packages.
teaser=ROOT/'public/phys-last-exam/teaser.pdf'
if teaser.exists():
    with pymupdf.open(teaser) as artwork:
        overview=artwork[0].get_pixmap(matrix=pymupdf.Matrix(3,3),alpha=False)
else:
    overview=doc[1].get_pixmap(matrix=pymupdf.Matrix(6,6),clip=pymupdf.Rect(72,68,542,418),alpha=False)
Image.frombytes('RGB',[overview.width,overview.height],overview.samples).save(ROOT/'public/phys-last-exam/paper-overview.webp',lossless=True,method=6)
print('Extracted Table 2:',len(tasks),'tasks,',len(rows),'model averages and logos')
