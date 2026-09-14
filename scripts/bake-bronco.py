"""Bake a separate web asset without overwriting the source Blender file."""
import bpy, os, json, hashlib, numpy as np
from mathutils import Vector
OUT='/home/liveuser/Documents/ford-bronco-web-20260914'
os.makedirs(OUT+'/textures',exist_ok=True)
fingerprint=hashlib.sha256(open(bpy.data.filepath,'rb').read()).hexdigest()
stamp=OUT+'/source.sha256'
if os.path.exists(stamp) and open(stamp).read().strip()!=fingerprint:
 raise RuntimeError('Source changed: choose a fresh OUT directory to avoid stale baked textures.')
open(stamp,'w').write(fingerprint+'\n')
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16
scene.render.bake.margin=8; scene.render.bake.use_clear=True
scene.render.bake.use_selected_to_active=False
# Preserve world placement before removing assembly parents.
objects=[o for o in scene.objects if o.type=='MESH' and len(o.data.polygons) and not o.hide_render]
worlds={o:o.matrix_world.copy() for o in objects}
for o in objects:
 o.parent=None; o.matrix_world=worlds[o]; o.hide_set(False)
for o in list(scene.objects):
 if o not in objects: bpy.data.objects.remove(o,do_unlink=True)
report={'source':bpy.data.filepath,'objects':[]}
cache={}
def active(o):
 bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o

def save_image(im):
 im.filepath_raw=OUT+'/textures/'+im.name+'.png'; im.file_format='PNG'; im.save(); im.pack()

for oi,o in enumerate(objects):
 print('PROGRESS',oi+1,len(objects),o.name,flush=True)
 active(o)
 for mod in o.modifiers:
  if mod.type=='SUBSURF': mod.levels=min(mod.levels,1); mod.render_levels=mod.levels
 bpy.ops.object.convert(target='MESH'); o=bpy.context.object
 o.data=o.data.copy()
 before=len(o.data.polygons)
 budget=40000 if o.name=='Body' else 24000
 if len(o.data.vertices)>budget:
  mod=o.modifiers.new('Web reduction','DECIMATE'); mod.ratio=min(1,budget/len(o.data.vertices))
  bpy.ops.object.modifier_apply(modifier=mod.name)
 # Reuse identical wheel meshes and baked textures.
 coords=np.empty(len(o.data.vertices)*3,dtype=np.float32); o.data.vertices.foreach_get('co',coords)
 sig=hashlib.sha256(coords.tobytes()+str([s.material.name for s in o.material_slots]).encode()).hexdigest()
 if sig in cache:
  o.data=cache[sig]; report['objects'].append({'name':o.name,'reused':True}); continue
 olduv=o.data.uv_layers.active.name if o.data.uv_layers else 'UVMap'
 originals=[s.material for s in o.material_slots]
 mats=[]; shaders=[]
 for m in originals:
  m=m.copy(); mats.append(m)
  nodes=m.node_tree.nodes; links=m.node_tree.links
  out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output)
  surf=out.inputs['Surface'].links[0].from_node
  p=surf if surf.type=='BSDF_PRINCIPLED' else next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
  shaders.append((p,out))
  uv=nodes.new('ShaderNodeUVMap'); uv.uv_map=olduv
  for n in list(nodes):
   if n.type=='TEX_COORD':
    for l in list(n.outputs['UV'].links): links.new(uv.outputs['UV'],l.to_socket)
   elif n.type=='TEX_IMAGE' and not n.inputs['Vector'].is_linked: links.new(uv.outputs['UV'],n.inputs['Vector'])
   elif n.type=='NORMAL_MAP' and not n.uv_map: n.uv_map=olduv
 for slot,m in zip(o.material_slots,mats): slot.material=m
 channels=['Base Color','Roughness','Metallic','Normal','Emission Color','Coat Weight','Coat Roughness','Transmission Weight','Alpha']
 for p,out in shaders:
  for ch in channels:
   socket=p.inputs[ch]
   if socket.is_linked and socket.links[0].from_node.type=='VALUE':
    link=socket.links[0]; value=link.from_socket.default_value
    p.id_data.links.remove(link); socket.default_value=value
 needed={ch:any(p.inputs[ch].is_linked for p,out in shaders) for ch in channels}
 baked={}
 if any(needed.values()):
  uv=o.data.uv_layers.new(name='WebUV'); o.data.uv_layers.active=uv; uv.active_render=True
  bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15192,island_margin=0.015); bpy.ops.object.mode_set(mode='OBJECT')
  res=2048 if o.name=='Body' else 1024
  for channel,need in needed.items():
   if not need: continue
   name=o.name.replace('.','_')+'_'+channel.replace(' ','_')
   existing=OUT+'/textures/'+name+'.png'
   if os.path.exists(existing):
    im=bpy.data.images.load(existing,check_existing=False); im.colorspace_settings.name='sRGB' if channel=='Base Color' else 'Non-Color'; im.pack(); baked[channel]=im; continue
   im=bpy.data.images.new(name,width=res,height=res,alpha=False)
   im.colorspace_settings.name='sRGB' if channel in ['Base Color','Emission Color'] else 'Non-Color'
   temp=[]
   for m,(p,out) in zip(mats,shaders):
    nodes=m.node_tree.nodes; links=m.node_tree.links
    target=nodes.new('ShaderNodeTexImage'); target.image=im; nodes.active=target
    original=out.inputs['Surface'].links[0].from_socket
    em=None
    if channel!='Normal':
     em=nodes.new('ShaderNodeEmission'); s=p.inputs[channel]
     if s.is_linked: links.new(s.links[0].from_socket,em.inputs['Color'])
     elif channel in ['Base Color','Emission Color']: em.inputs['Color'].default_value=s.default_value
     else: em.inputs['Color'].default_value=(*([s.default_value]*3),1)
     links.new(em.outputs[0],out.inputs['Surface'])
    temp.append((m,target,em,out,original))
   print('BAKE',o.name,channel,res,flush=True)
   bpy.ops.object.bake(type='NORMAL' if channel=='Normal' else 'EMIT')
   save_image(im); baked[channel]=im
   for m,target,em,out,original in temp:
    m.node_tree.links.new(original,out.inputs['Surface'])
    m.node_tree.nodes.remove(target)
    if em: m.node_tree.nodes.remove(em)
 # Rebuild standard PBR materials, retaining glass, emission, and coat constants.
 for idx,(m,(p,out)) in enumerate(zip(mats,shaders)):
  new=bpy.data.materials.new(originals[idx].name+'__'+o.name); new.use_nodes=True
  q=new.node_tree.nodes.get('Principled BSDF'); nodes=new.node_tree.nodes; links=new.node_tree.links
  for s in p.inputs:
   if s.name in q.inputs and hasattr(s,'default_value'):
    try: q.inputs[s.name].default_value=s.default_value
    except: pass
  for channel,im in baked.items():
   tex=nodes.new('ShaderNodeTexImage'); tex.image=im
   uv=nodes.new('ShaderNodeUVMap'); uv.uv_map='WebUV'; links.new(uv.outputs[0],tex.inputs['Vector'])
   if channel=='Normal':
    norm=nodes.new('ShaderNodeNormalMap'); norm.uv_map='WebUV'; links.new(tex.outputs['Color'],norm.inputs['Color']); links.new(norm.outputs[0],q.inputs['Normal'])
   else: links.new(tex.outputs['Color'],q.inputs[channel])
  o.material_slots[idx].material=new
 if baked:
  # Source UV is no longer needed after baking; reduce exported attributes.
  for layer in list(o.data.uv_layers):
   if layer.name!='WebUV': o.data.uv_layers.remove(layer)
 cache[sig]=o.data
 report['objects'].append({'name':o.name,'faces_before':before,'faces_after':len(o.data.polygons),'baked':list(baked)})
 # Checkpoint enables inspection even during long bakes.
 open(OUT+'/bake-report.json','w').write(json.dumps(report,indent=2))
# Ground and center while preserving relative placements.
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
lo=Vector(tuple(min(v[i] for v in points) for i in range(3))); hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
offset=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
for o in objects:
 world=o.matrix_world.copy(); o.parent=None; world.translation-=offset; o.matrix_world=world
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/Ud-baked.blend')
bpy.ops.export_scene.gltf(filepath=OUT+'/Ud.glb',export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_extras=False)
print('EXPORT_COMPLETE',os.path.getsize(OUT+'/Ud.glb'),flush=True)
