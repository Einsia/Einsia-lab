"""Run with Blender against a submitted .blend; never saves the source project."""
import bpy,json,pathlib,sys,hashlib,time
from mathutils import Vector
jid,outdir=sys.argv[sys.argv.index('--')+1:]
out=pathlib.Path(outdir);out.mkdir(parents=True,exist_ok=True)
w=pathlib.Path('/opt/dlami/nvme/liuqingle/frontier3d-showcase-20261104/gallery-v2')
j=next(j for j in json.loads((w/'blender-jobs.json').read_text()) if j['id']==jid)
meta=json.loads((w/'meta'/(jid+'.json')).read_text())
source=pathlib.Path(j['blend']);before=hashlib.sha256(source.read_bytes()).hexdigest()
names={o['name'] for o in meta['objects']}
bpy.ops.object.select_all(action='DESELECT')
selected=[]
for o in bpy.context.scene.objects:
 if o.name in names:
  o.hide_set(False);o.hide_viewport=False;o.select_set(True);selected.append(o)
assert selected
# Export uses evaluated meshes with modifiers, preserving authored materials.
# Cameras and lights are presentation-only and are never included.
bpy.context.view_layer.objects.active=selected[0]
# Bake authored procedural base color into a portable vertex-color layer.
# Emission baking isolates albedo from lighting, metalness, and exposure.
bpy.ops.object.convert(target='MESH')
selected=list(bpy.context.selected_objects)
materials={m for o in selected for m in o.data.materials if m and m.use_nodes}
restore=[]
for m in materials:
 nt=m.node_tree; output=next((n for n in nt.nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output),None)
 bsdf=next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not output or not bsdf: continue
 surface=output.inputs['Surface'];previous=surface.links[0].from_socket if surface.is_linked else None
 emit=nt.nodes.new('ShaderNodeEmission');base=bsdf.inputs['Base Color']
 if base.is_linked:nt.links.new(base.links[0].from_socket,emit.inputs['Color'])
 else:emit.inputs['Color'].default_value=base.default_value
 nt.links.new(emit.outputs[0],surface);restore.append((nt,output,previous,emit,bsdf))
for o in selected:
 if o.type=='MESH':
  attr=o.data.color_attributes.new(name='BakedBaseColor',type='FLOAT_COLOR',domain='CORNER')
  o.data.color_attributes.active_color=attr
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.device='CPU';scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.bake(type='EMIT',target='VERTEX_COLORS',use_clear=True)
for nt,output,previous,emit,bsdf in restore:
 nt.nodes.remove(emit)
 if previous:nt.links.new(previous,output.inputs['Surface'])
 base=bsdf.inputs['Base Color']
 for link in list(base.links):nt.links.remove(link)
 base.default_value=(1,1,1,1)
path=out/(jid+'.glb')
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=6,export_vertex_color="NAME",export_vertex_color_name="BakedBaseColor",export_all_vertex_colors=False,export_yup=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
points=[Vector(v) for o in meta['objects'] for v in (o['lo'],o['hi'])]
lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
(out/(jid+'.json')).write_text(json.dumps({'id':jid,'task':j['task'],'model':j['model'],'effort':j['source']['effort'],'source_blend_sha256':before,'generation_sha256':j['source']['generation_sha256'],'source_files_sha256':j['source']['source_sha256'],'source_object_count':len(selected),'source_polygons':sum(o.get('polygons',0) for o in meta['objects']),'bounds_blender':[lo,hi],'center_blender':[(lo[i]+hi[i])/2 for i in range(3)],'file':jid+'.glb','bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'format':'glTF 2.0 / Draco','geometry':'Evaluated source geometry; modifiers applied for export; no mesh decimation','materials':'Original procedural base color baked by Cycles emission pass into per-corner vertex colors; PBR metallic/roughness retained','source_unchanged':True},indent=2))
print('EXPORT_OK',jid,path.stat().st_size)
