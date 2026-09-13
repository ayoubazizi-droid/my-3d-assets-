"""Bake the source material, export its sampled scene, render the unchanged animation.
Run: blender --factory-startup -b /home/liveuser/Documents/pix3lware.blend -t 4 --python scripts/build-loader.py
Never writes to the source .blend. Encoded video uses the original camera and 24 fps.
"""
import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'assets/loader'
out.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene
original_engine=s.render.engine
s.frame_set(s.frame_start)
meshes=[o for o in s.objects if o.type=='MESH' and not o.hide_render]
material=bpy.data.materials['Material.001']
# All cubes share this single constant emissive material; one bake is lossless.
assert len([m for m in bpy.data.materials if m.users])==1
assert not any(n.type=='TEX_ENVIRONMENT' for n in s.world.node_tree.nodes)
obj=meshes[0]
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active=obj
if not obj.data.uv_layers:
 bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(); bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('pix3lware-baked-emission',width=64,height=64,alpha=False)
node=material.node_tree.nodes.new('ShaderNodeTexImage')
node.image=image
material.node_tree.nodes.active=node
s.render.engine='CYCLES'
s.cycles.device='CPU'
s.cycles.samples=1
s.render.bake.margin=4
bpy.ops.object.bake(type='EMIT')
image.filepath_raw=str(out/'emission.png')
image.file_format='PNG'
image.save()
# Use the baked material for delivery and the render; preserve the original shader settings.
material.node_tree.links.new(node.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'])
for o in meshes:
 if not o.data.uv_layers:
  uv=o.data.uv_layers.new(name='UVMap')
  for loop in uv.data: loop.uv=(0.5,0.5)
s.render.engine=original_engine
# Scene mode samples all object + camera + parent animations into ONE synchronized clip.
bpy.ops.export_scene.gltf(filepath=str(out/'pix3lware.glb'),export_format='GLB',export_cameras=True,export_lights=False,export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_frame_step=1,export_force_sampling=True,export_materials='EXPORT',export_yup=True)
meta={'source':'pix3lware.blend','frames':[s.frame_start,s.frame_end],'fps':s.render.fps/s.render.fps_base,'duration_seconds':(s.frame_end-s.frame_start+1)/(s.render.fps/s.render.fps_base),'camera':s.camera.name,'animated_meshes':len(meshes),'material':'64x64 baked emission map; original material settings','hdri_added':False,'render_engine':original_engine,'delivery':'720x720 MP4 / WebM; original frames and camera; no retiming'}
(out/'animation.json').write_text(json.dumps(meta,indent=2)+'\n')
# Original scene, timeline, camera, world, materials, color management. Only reduce output size.
s.render.resolution_percentage=100
s.render.resolution_x=720
s.render.resolution_y=720
s.render.image_settings.media_type='IMAGE'
s.render.image_settings.file_format='PNG'
s.render.image_settings.color_mode='RGB'
frames=Path('/tmp/pix3lware-loader-frames')
frames.mkdir(exist_ok=True)
s.render.filepath=str(frames/'frame-')
bpy.ops.render.render(animation=True)
