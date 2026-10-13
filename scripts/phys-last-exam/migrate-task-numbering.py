"""One-shot legacy -> P1–P40 migration, staged and validated before installation.
Never rename in place: P1/P2/P4 and several other IDs form cycles.
"""
import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEME = 'category-difficulty-p1-p40-v1'
def read(p): return json.loads(p.read_text(), parse_constant=lambda _: None)
def write(p, obj): p.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':'))+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    live = ROOT/'public/phys-last-exam'
    results = read(live/'paper-results.json')
    if results.get('numberingScheme') == SCHEME:
        raise SystemExit('Already migrated; refusing to apply legacy mapping a second time.')
    rows = []
    for level in ('easy', 'medium', 'hard'):
        for doc in (args.package/level).glob('P*/task.md'):
            old = re.search(r'原编号：`(P\d+[a-z]?)`', doc.read_text())[1]
            task = next(t for t in results['tasks'] if t['id'] == old)
            new = doc.parent.name
            assert task['paperId'] == new and task['difficulty'].lower() == level, doc
            rows.append(dict(legacyId=old, id=new, name=task['name'], category=task['category'], difficulty=task['difficulty'], packagePath=f'{level}/{new}', definitionSha256=sha(doc), firstFrameSha256=sha(doc.parent/'first_frame.png'), promptSha256=sha(doc.parent/'prompt.txt')))
    rows.sort(key=lambda t:int(t['id'][1:]))
    mapping = {r['legacyId']:r['id'] for r in rows}
    assert len(mapping)==40 and {r['id'] for r in rows}=={f'P{i}' for i in range(1,41)}
    assert set(mapping)=={t['id'] for t in results['tasks']}
    workspace=ROOT/'.local/phys-last-exam/numbering-migration'
    workspace.mkdir(parents=True,exist_ok=True)
    stage=workspace/'staged-public/phys-last-exam'
    backup=workspace/'legacy-public/phys-last-exam'
    assert not stage.exists() and not backup.exists(), 'Staging/backup already exists; inspect before rerunning.'
    stage.mkdir(parents=True)
    def pathmap(rel):
        parts=list(rel.parts)
        if parts[0] in ('videos','evidence'): parts[2]=mapping[parts[2]]
        elif parts[0]=='tasks': parts[1]=mapping[Path(parts[1]).stem]+Path(parts[1]).suffix
        return Path(*parts)
    def urlmap(value):
        if isinstance(value,str) and value.startswith('/phys-last-exam/'):
            return '/phys-last-exam/'+pathmap(Path(value.removeprefix('/phys-last-exam/'))).as_posix()
        if isinstance(value,list): return [urlmap(v) for v in value]
        if isinstance(value,dict): return {k:urlmap(v) for k,v in value.items()}
        return value
    audit=[]
    targets=set()
    # Every source is read from the untouched legacy tree, including cyclic IDs.
    for source in sorted(live.rglob('*')):
        if not source.is_file(): continue
        rel=source.relative_to(live); destrel=pathmap(rel)
        assert destrel not in targets, f'Collision: {destrel}'
        targets.add(destrel); dest=stage/destrel; dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,dest)
        if rel.parts[0] in ('videos','evidence','tasks'):
            audit.append(dict(source=rel.as_posix(),target=destrel.as_posix(),sha256=sha(source)))
    # Verify all renamed bytes before making metadata changes.
    for item in audit: assert sha(stage/item['target'])==item['sha256'], item
    write(workspace/'byte-transfer-audit.json',audit)
    index=dict(numberingScheme=SCHEME,source='vdmbench_origin/vdmbench',tasks=rows)
    write(stage/'task-index.json',index)
    for t in results['tasks']:
        t['legacyId']=t['id'];t['id']=mapping[t['id']];t.pop('paperId')
    results['numberingScheme']=SCHEME
    write(stage/'paper-results.json',results)
    oldbench=read(live/'benchmark.json'); oldtasks={t['id']:t for t in oldbench['tasks']}
    tasks=[]
    for r in rows:
        old=oldtasks[r['legacyId']]; package=args.package/r['packagePath']
        prompt=(package/'prompt.txt').read_text().strip()
        task={k:old[k] for k in ('nameZh','domain') if k in old}
        task.update({k:r[k] for k in ('id','legacyId','name','category','difficulty')})
        task.update(preview=f"/phys-last-exam/tasks/{r['id']}.webp",previewSource=r['packagePath']+'/first_frame.png',firstFrameSha256=r['firstFrameSha256'],prompt=prompt,promptVariants=[dict(text=prompt,sources=[r['packagePath']+'/prompt.txt'])])
        tasks.append(task)
    # Preview image content is refreshed from the canonical first frames.
    from PIL import Image
    for r in rows:
        with Image.open(args.package/r['packagePath']/'first_frame.png') as im:
            im=im.convert('RGB');im.thumbnail((640,640));im.save(stage/'tasks'/f"{r['id']}.webp",quality=88)
    bench={k:oldbench[k] for k in ('route','seeds')}
    bench['models']=results['models']
    bench.update(taskPackage='vdmbench_origin/vdmbench',numberingScheme=SCHEME,promptNote='Canonical task-package prompts and first frames.',categories=results['categories'],tasks=tasks)
    write(stage/'benchmark.json',bench)
    gallery=urlmap(read(live/'video-gallery.json'))
    gallery.update(numberingScheme=SCHEME,package='vdmbench_origin/vdmbench')
    for e in gallery['entries']:
        e['legacyTaskId']=e['task'];e['task']=mapping[e['task']]
        if 'source' in e: e['legacySource']=e.pop('source')
    # Rename structured task identifiers, but preserve real historical file paths.
    # Those paths identify immutable evaluator inputs and are explicitly documented.
    def evidence_ids(value):
        if isinstance(value,dict):
            return {k:(mapping[v] if k in ('task','task_id') and isinstance(v,str) and v in mapping else evidence_ids(v)) for k,v in value.items()}
        if isinstance(value,list): return [evidence_ids(v) for v in value]
        return value
    for file in (stage/'evidence').rglob('*.json'):
        obj=read(file); new=evidence_ids(obj)
        if isinstance(new,dict):
            new['numberingScheme']=SCHEME
            new['legacyProvenanceNote']='Historical filesystem paths and sample names use legacy task IDs; structured task/task_id fields use current IDs.'
        write(file,new)
    for e in gallery['entries']:
        run=e.get('initializationRun')
        if run:
            run['signature']['legacyAnnotation']=run['signature']['annotation']
            run['signature']['annotation']=sha(stage/Path(run['annotation']).relative_to('/phys-last-exam'))
    gallery['entries'].sort(key=lambda e:(e['model'],int(e['task'][1:]),e['seed']))
    write(stage/'video-gallery.json',gallery)
    summary=read(stage/'initialization-rerun-summary.json')
    for key in ('taskCounts','byTask'): summary[key]={mapping[k]:v for k,v in summary[key].items()}
    summary['numberingScheme']=SCHEME;write(stage/'initialization-rerun-summary.json',summary)
    # Check every sample still has the exact same original/debug video bytes.
    oldgallery=read(live/'video-gallery.json')
    newentries={(e['model'],e['task'],e['seed']):e for e in gallery['entries']}
    for old in oldgallery['entries']:
        new=newentries[(old['model'],mapping[old['task']],old['seed'])]
        for key in ('original','annotated','poster'):
            if old.get(key): assert sha(ROOT/'public'/old[key].lstrip('/'))==sha(stage/Path(new[key]).relative_to('/phys-last-exam'))
    readme=stage/'README.md'
    readme.write_text(readme.read_text()+ '\n## Canonical task numbering\n\nAll public resource paths and structured task identifiers use P1–P40 from `vdmbench_origin/vdmbench`. `task-index.json` explicitly pairs current `id` with `legacyId`. Historical source paths/sample names and burned-in evaluator evidence remain unchanged as provenance; they use legacy IDs. Scores, video bytes and initialization coordinates are unchanged. Annotation signatures are updated for metadata-only ID changes; the original signature is retained as `legacyAnnotation`.\n')
    assets=[dict(url='/phys-last-exam/'+p.relative_to(stage).as_posix(),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(stage.rglob('*')) if p.is_file() and p.name!='release-assets.json']
    write(stage/'release-assets.json',dict(version=1,generatedAt=datetime.now(timezone.utc).isoformat(),bytes=sum(a['bytes'] for a in assets),assets=assets))
    import subprocess
    subprocess.run(['node',str(ROOT/'scripts/phys-last-exam/validate-web-release.mjs'),'--root',str(stage.parent)],check=True)
    if args.install:
        backup.parent.mkdir(parents=True,exist_ok=True)
        live.rename(backup)
        try: stage.rename(live)
        except BaseException:
            backup.rename(live);raise
    print(f'Validated {len(rows)} task mappings and {len(gallery["entries"])} sample identities. Installed: {args.install}. Backup: {backup}')

if __name__=='__main__':main()
