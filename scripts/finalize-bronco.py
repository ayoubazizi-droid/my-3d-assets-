import bpy,os
OUT='/home/liveuser/Documents/ford-bronco-web-20260914'
# glTF has one PBR shader per material. Approximate the source window shader
# mixes with weighted PBR values so the rear window retains its darker tint.
with bpy.data.libraries.load('/home/liveuser/Documents/ford bronco.blend', link=False) as (source, target):
 target.materials=[name for name in source.materials if name.startswith('Glass Windows')]
for original in target.materials:
 output=next(n for n in original.node_tree.nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output)
 mix=output.inputs['Surface'].links[0].from_node
 if mix.type!='MIX_SHADER': continue
 factor=mix.inputs[0].default_value
 a=mix.inputs[1].links[0].from_node; b=mix.inputs[2].links[0].from_node
 if a.type!='BSDF_PRINCIPLED' or b.type!='BSDF_PRINCIPLED': continue
 for slot in bpy.data.objects['windows'].material_slots:
  if not slot.material.name.startswith(original.name.split('.00')[0]+'__'): continue
  shader=slot.material.node_tree.nodes.get('Principled BSDF')
  for channel in ['Base Color','Metallic','Roughness','IOR','Transmission Weight']:
   av=a.inputs[channel].default_value; bv=b.inputs[channel].default_value
   shader.inputs[channel].default_value=tuple(x*(1-factor)+y*factor for x,y in zip(av,bv)) if channel=='Base Color' else av*(1-factor)+bv*factor
for im in bpy.data.images:
 if im.name.removesuffix('.png').endswith(('_Base_Color','_Roughness','_Metallic')):
  # Lossless normal maps; JPEG for color and scalar textures.
  im.filepath_raw=OUT+'/textures/'+im.name+'.jpg'; im.file_format='JPEG'; im.save(); im.pack()
seen=set()
for o in list(bpy.context.scene.objects):
 if o.type!='MESH' or o.data in seen: continue
 old=o.data; users=[x for x in bpy.context.scene.objects if x.type=='MESH' and x.data==old]
 o.data=old.copy(); bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Web triangulation','TRIANGULATE')
 if hasattr(mod,'keep_custom_normals'): mod.keep_custom_normals=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 for x in users: x.data=o.data
 seen.add(o.data)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/Ud-baked.blend')
bpy.ops.export_scene.gltf(filepath=OUT+'/Ud.glb',export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_tangents=True,export_image_format='AUTO',export_jpeg_quality=90,export_extras=False)
print('FINAL_BYTES',os.path.getsize(OUT+'/Ud.glb'))
