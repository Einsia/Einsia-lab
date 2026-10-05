"""Build a portable site snapshot from the V3 task package and Markdown report.
Usage: python scripts/sync-physmeter.py /path/to/vdmbench2/vdmbench/v3
Requires Pillow for compact first-frame previews. Does not execute evaluators.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
package = Path(sys.argv[1])
report_path = ROOT / 'reference/详细评测报告.md'
report = report_path.read_text()

def table(section):
    lines = [line for line in section.splitlines() if line.startswith('|')]
    rows = [[cell.strip() for cell in line.strip('|').split('|')] for line in lines]
    return rows[2:]

def section(start, end):
    return report.split(start, 1)[1].split(end, 1)[0]

def fraction(value):
    match = re.match(r'(\d+)/(\d+)', value)
    assert match, value
    return tuple(map(int, match.groups()))

def video_prompts(path):
    # Prefer the current continuation prompt, never first-frame/simulation/legacy text.
    canonical = path / 'prompts/video.txt'
    if canonical.exists():
        files = [canonical]
    elif (path / 'video_prompts').is_dir():
        files = sorted((path / 'video_prompts').glob('*.txt'))
    else:
        files = [path / 'prompt.txt']  # Original package layout.
    assert files, f'No continuation prompts for {path.name}'
    variants = {}
    for file in files:
        text = file.read_text().strip()
        assert text, f'Empty prompt: {file}'
        variants.setdefault(text, []).append(str(file.relative_to(package)))
    return [dict(text=text, sources=sources) for text, sources in variants.items()]

categories = [
 ('motion', 'Translational motion & collisions', 'mechanics', 'P1 P2 P3 P4 P5'),
 ('rolling', 'Rolling, friction & rigid-body statics', 'mechanics', 'P6 P7 P10 P42 P43 P44'),
 ('oscillations', 'Pendulum motion & oscillations', 'mechanics', 'P8a P8b P8c P9'),
 ('optics', 'Optics & projective geometry', 'optics', 'P11 P12 P13 P14 P16'),
 ('hydrostatics', 'Hydrostatics & buoyancy', 'fluids', 'P18 P19 P20'),
 ('thermal', 'Phase transitions & melting', 'thermal', 'P21 P21b P21c P23 P27'),
 ('electromagnetism', 'Electrostatics, magnetism & induction', 'electromagnetism', 'P28 P34 P36 P37 P38 P39'),
 ('granular', 'Granular media & discharge flow', 'fluids', 'P40 P41'),
 ('interfaces', 'Surface tension & viscous flow', 'fluids', 'P45 P47 P48 P49'),
]
names = dict(zip(
 'P1 P2 P3 P4 P5 P6 P7 P8a P8b P8c P9 P10 P11 P12 P13 P14 P16 P18 P19 P20 P21 P21b P21c P23 P27 P28 P34 P36 P37 P38 P39 P40 P41 P42 P43 P44 P45 P47 P48 P49'.split(),
 ['Free fall', 'Projectile motion', 'Complementary-angle projection', 'Bounce-height decay', 'Equal-mass head-on collision', 'Pure rolling of a solid sphere', 'Solid sphere vs. hoop', 'Small-angle isochronism', 'Mass-independent pendulum period', 'Large-angle pendulum period', 'Period–length relationship', 'Rough-incline round trip', 'Light refraction', 'Critical angle for total reflection', 'Light reflection', 'Point-source projection concurrency', 'Collinear-point cross-ratio', 'Liquid surface vs. gravity', 'Communicating-vessel equilibrium', 'Floating-ice submerged fraction', 'Water level during ice melting', 'Melting ice containing a stone', 'Freshwater ice melting in saltwater', 'Freezing-induced expansion', 'Crushed vs. intact ice melting', 'Charged-sphere equilibrium', 'Current-carrying wire and compass', 'Eddy-current braking', 'Closed vs. open jumping rings', 'Solid vs. slotted plate damping', 'Coil-induced light emission', 'Sandpile angle-of-repose scaling', 'Sand vs. water funnel discharge', 'Mass-independent sliding onset', 'Toppling about a support edge', 'Hanging-chain equilibrium', 'Capillary rise vs. tube diameter', 'Soap-bubble film curvature', 'Volume-conserving droplet coalescence', 'Sphere terminal speed in viscous flow']))
models = []
for r in table(section('## 2. 模型总表', '### 2.1')):
    passed, total = fraction(r[8]); _, determinate = fraction(r[9])
    models.append(dict(name=r[0], n=int(r[1]), consistency=float(r[2]), physicalN=int(r[4]), physics=float(r[5]), effectivePhysics=float(r[6]), overall=float(r[7]), passed=passed, successPercent=float(re.search(r'（([0-9.]+)%', r[8]).group(1)), determinate=determinate, difficulty={}))
for r in table(section('### 2.1 按模型及难度拆分', '## 3.')):
    model = next(m for m in models if m['name'] == r[0])
    model['difficulty'][r[1]] = dict(n=int(r[2]), score=float(r[7]))

paths = {p.name: p for p in package.glob('g[1-9]/P*') if p.is_dir()}
rows = table(section('### 3.3 V3 总分均值', '### 3.4'))
assert len(rows) == 40 and set(paths) == {r[0] for r in rows}
assets = ROOT / 'public/physmeter/tasks'
assets.mkdir(parents=True, exist_ok=True)
tasks = []
for r in rows:
    task_id, name_zh, difficulty = r[:3]
    path = paths[task_id]
    cat = next(c for c in categories if task_id in c[3].split())
    detail = report.split(f'### {task_id} ·', 1)[1].split('<details>', 1)[0]
    scores = table(detail)
    assert len(scores) == 8
    assert [s[0] for s in scores] == [m['name'] for m in models]
    assert [float(s[6]) for s in scores] == [float(value) for value in r[3:]]
    n = sum(int(s[1]) for s in scores)
    executed = sum(int(s[4]) for s in scores)
    passed = sum(fraction(s[7])[0] for s in scores)
    determinate = sum(fraction(s[8])[1] for s in scores)
    assert sum(int(s[9]) for s in scores) == executed - determinate
    candidates = [path / 'first_frame.png'] if (path / 'first_frame.png').exists() else sorted(path.glob('first_frames/gpt/*.png'))
    prompts = video_prompts(path)
    preview = None
    if candidates:
        image = Image.open(candidates[0]).convert('RGB')
        image.thumbnail((640, 400))
        image.save(assets / f'{task_id}.webp', quality=82)
        preview = f'/physmeter/tasks/{task_id}.webp'
    tasks.append(dict(id=task_id, name=names[task_id], nameZh=name_zh, difficulty=difficulty, category=cat[0], domain=cat[2], group=path.parent.name.upper(), n=n, executed=executed, passed=passed, determinate=determinate, failed=determinate-passed, insufficient=n-determinate, preview=preview, previewSource=str(candidates[0].relative_to(package)) if candidates else None, prompt=prompts[0]['text'], promptVariants=prompts, scores={s[0]:float(s[6]) for s in scores}))

assert len(models) == 8 and all(set(m['difficulty']) == {'Easy','Medium','Hard'} for m in models)
assert sum(t['n'] for t in tasks) == sum(m['n'] for m in models) == 1278
assert sum(t['passed'] for t in tasks) == sum(m['passed'] for m in models) == 159
assert sum(t['determinate'] for t in tasks) == 716
assert sum(t['executed'] for t in tasks) == 1257
assert Counter(t['difficulty'] for t in tasks) == {'Easy':10, 'Medium':17, 'Hard':13}
for m in models:
    assert sum(d['n'] for d in m['difficulty'].values()) == m['n']
    weighted = sum(d['n']*d['score'] for d in m['difficulty'].values())/m['n']
    assert abs(weighted-m['overall']) < .015
    assert abs(.15*m['consistency']+.85*m['effectivePhysics']-m['overall']) < .015
    for level, d in m['difficulty'].items():
        subset = [t for t in tasks if t['difficulty']==level]
        count = lambda t: 3 if m['name']=='Cosmos3' and t['id'] in ['P5','P13'] else 4
        assert sum(count(t) for t in subset) == d['n']
        assert abs(sum(t['scores'][m['name']]*count(t) for t in subset)/d['n']-d['score']) < .015

snapshot = dict(taskPackage='vdmbench2/vdmbench/v3', promptNote='Current package continuation prompts; leaderboard scores remain from the September 21 evaluation snapshot.', reportDate='2026-09-29', snapshotDate='2026-09-21', reportSha256=hashlib.sha256(report_path.read_bytes()).hexdigest(), route='GPT first frame', seeds=[42,43,44,45], categories=[dict(id=c[0], name=c[1], domain=c[2]) for c in categories], models=models, tasks=tasks)
(ROOT/'public/physmeter/benchmark.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+'\n')
print(f'Validated and exported {len(tasks)} tasks, {len(models)} models, 1278 videos; {len(list(assets.glob("*.webp")))} previews.')
