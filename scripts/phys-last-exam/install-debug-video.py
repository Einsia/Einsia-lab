"""Install framewise visualization into V3; leave measurement expressions intact."""
import argparse, ast, shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('package',type=Path);a=p.parse_args();root=a.package
shutil.copyfile(Path(__file__).parent/'evaluator-patches/debug_video.py',root/'shared/physeval/debug_video.py')
def wrap(path,function,helper,arguments):
 text=path.read_text()
 if f'from shared.physeval.debug_video import {helper}' in text:return
 tree=ast.parse(text);fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==function)
 lines=text.splitlines(keepends=True);offsets=[0]
 for line in lines:offsets.append(offsets[-1]+len(line))
 # Return expressions can contain Chinese strings; AST columns count UTF-8 bytes.
 def position(line,col):return offsets[line-1]+len(lines[line-1].encode()[:col].decode())
 edits=[]
 for node in ast.walk(fn):
  if isinstance(node,ast.Return) and node.value:
   v=node.value;start=position(v.lineno,v.col_offset);end=position(v.end_lineno,v.end_col_offset)
   edits.append((start,end,f'{helper}({text[start:end]}, {arguments})'))
 for start,end,new in sorted(edits,reverse=True):text=text[:start]+new+text[end:]
 # Insert immediately before the function, after module imports and constants.
 index=text.index('def '+function+'(')
 text=text[:index]+f'from shared.physeval.debug_video import {helper}\n\n\n'+text[index:]
 ast.parse(text);path.write_text(text)
for task in ['p1','p2','p5','p8a','p8b','p14','p16','p18','p20','p21','p45','p48']:
 wrap(root/f'shared/physeval/tasks/{task}.py','run' if task=='p8a' else 'evaluate','finish_shared','clip, ctx, locals()')
for task,module in {'P7':'p7_rotational','P8c':'p8c_pendulum','P10':'p10_mechanics','P12':'p12_optics','P27':'p27_thermal'}.items():
 wrap(root/f'g7/{task}/evaluator/{module}.py','evaluate_frames' if task=='P12' else 'evaluate','finish_g7',f"'{task}', frames, fps, debug_dir, locals()")
# Keep direct execution of each G7 module working, even outside the V3 cwd.
for task,module in {'P10':'p10_mechanics','P12':'p12_optics','P27':'p27_thermal'}.items():
 path=root/f'g7/{task}/evaluator/{module}.py';text=path.read_text()
 if '_V3_VIS_ROOT' not in text:
  text=text.replace('from shared.physeval.debug_video import finish_g7', 'import sys\n_V3_VIS_ROOT = str(Path(__file__).resolve().parents[3])\nif _V3_VIS_ROOT not in sys.path:\n    sys.path.insert(0, _V3_VIS_ROOT)\nfrom shared.physeval.debug_video import finish_g7')
  path.write_text(text)
p=root/'shared/physeval/liquid.py';text=p.read_text()
if 'with torch.no_grad(), torch.autocast' not in text:
 text=text.replace('with torch.no_grad():', 'with torch.no_grad(), torch.autocast(device_type="cuda", dtype=torch.bfloat16, enabled=device.startswith("cuda")):')
 p.write_text(text)
# Shipped shared-task CLIs used the parent of V3 as their import root.
for path in root.glob('g*/P*/evaluator/measure_backend.py'):
 text=path.read_text()
 if 'from shared.physeval import' in text:
  text=text.replace('V3_ROOT = HERE.parents[3]', 'V3_ROOT = HERE.parents[2]')
  path.write_text(text)
p=root/'shared/physeval/schema.py';text=p.read_text()
if 'debug_video: str' not in text:
 text=text.replace('    debug_image: str | None = None','    debug_image: str | None = None\n    debug_video: str | None = None')
 text=text.replace('        if self.debug_image:', '        if self.debug_video:\n            payload["verbose"]["debug_video"] = self.debug_video\n        if self.debug_image:');p.write_text(text)
print('Installed native framewise debug output for 17 tasks.')
