"""Export authored intro curves and geometry without modifying the Blender file.

blender --factory-startup -b SOURCE.blend --python scripts/export-intro.py
"""
import bpy
import hashlib
import json
from pathlib import Path
from mathutils import Matrix
from bpy_extras.object_utils import world_to_camera_view

scene = bpy.context.scene
root = Path(__file__).resolve().parents[1]
source = Path(bpy.data.filepath)
roles = {'0001-0148': 'video', 'pixelware full logo-removebg-preview': 'logo',
         'screenframe ': 'screenframe', 'website_Screenshot.001': 'website'}
scene.frame_set(1)
camera = scene.camera
if not camera or camera.animation_data or camera.constraints or camera.parent:
    raise RuntimeError('This export requires the authored static camera')
projection = camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),
    x=scene.render.resolution_x, y=scene.render.resolution_y,
    scale_x=scene.render.pixel_aspect_x, scale_y=scene.render.pixel_aspect_y)
view_projection = projection @ camera.matrix_world.inverted()
planes = []
all_key_frames = {scene.frame_start, scene.frame_end}
for obj in scene.objects:
    if obj == camera:
        continue
    if obj.name not in roles:
        raise RuntimeError(f'Unmapped intro object: {obj.name}')
    if obj.parent or obj.modifiers or obj.constraints:
        raise RuntimeError(f'Bake parent/modifier/constraint evaluation before exporting {obj.name}')
    obj.data.calc_loop_triangles()
    curves = []
    animation = obj.animation_data
    if animation and animation.action:
        for layer in animation.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    if bag.slot_handle != animation.action_slot_handle:
                        continue
                    for curve in bag.fcurves:
                        if curve.modifiers:
                            raise RuntimeError(f'Unsupported F-curve modifier: {obj.name}/{curve.data_path}')
                        points = []
                        for key in curve.keyframe_points:
                            all_key_frames.add(float(key.co.x))
                            points.append({'frame': float(key.co.x), 'value': float(key.co.y),
                                           'left': list(key.handle_left), 'right': list(key.handle_right),
                                           'interpolation': key.interpolation})
                        curves.append({'path': curve.data_path, 'index': curve.array_index,
                                       'extrapolation': curve.extrapolation, 'points': points})
    textures = [n for slot in obj.material_slots for n in slot.material.node_tree.nodes if n.type == 'TEX_IMAGE']
    if len(textures) != 1:
        raise RuntimeError(f'Expected one image on {obj.name}')
    texture = textures[0]
    vertices = [list(v.co) for v in obj.data.vertices]
    uv = [list(loop.uv) for loop in obj.data.uv_layers.active.data]
    lo = [min(v[axis] for v in vertices) for axis in range(3)]
    hi = [max(v[axis] for v in vertices) for axis in range(3)]
    planes.append({'name': obj.name, 'role': roles[obj.name],
                   'base': {'location': list(obj.location), 'rotation_euler': list(obj.rotation_euler),
                            'scale': list(obj.scale), 'hide_render': obj.hide_render, 'hide_viewport': obj.hide_viewport},
                   'bounds': {'min': lo, 'max': hi}, 'vertices': vertices,
                   'polygons': [list(poly.vertices) for poly in obj.data.polygons],
                   'uv': uv, 'image': {'name': texture.image.name, 'size': list(texture.image.size),
                                     'frameStart': texture.image_user.frame_start,
                                     'frameOffset': texture.image_user.frame_offset,
                                     'frameDuration': texture.image_user.frame_duration},
                   'curves': curves})

end = max(all_key_frames)
fps = scene.render.fps / scene.render.fps_base
website = next(p for p in planes if p['role'] == 'website')
layout = bpy.data.screens.get('Layout')
views = [a for a in layout.areas if a.type == 'VIEW_3D'] if layout else []
view = views[0].spaces.active.region_3d if views else None
data = {'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'fps': fps, 'start': scene.frame_start, 'timelineEnd': scene.frame_end, 'end': end,
        'keyFrames': sorted(all_key_frames),
        'camera': {'name': camera.name, 'type': camera.data.type, 'lens': camera.data.lens,
                   'resolution': [scene.render.resolution_x, scene.render.resolution_y],
                   'viewProjection': [list(row) for row in view_projection]},
        'savedViewport': {'location': list(view.view_location), 'rotation': list(view.view_rotation),
                          'distance': view.view_distance, 'perspective': view.view_perspective,
                          'size': [views[0].width, views[0].height]} if view else None,
        'reference': {'min': website['bounds']['min'][:2], 'max': website['bounds']['max'][:2],
                      'imageSize': website['image']['size']}, 'planes': planes}
(root/'assets/branding/intro-keyframes.json').write_text(json.dumps(data, indent=2)+'\n')
# Independent oracle: Blender's evaluated geometry at every quarter-frame.
oracle = []
for step in range(round((end-scene.frame_start)*4)+1):
    frame = scene.frame_start + step/4
    scene.frame_set(int(frame), subframe=frame-int(frame))
    def evaluated(obj):
        # Hidden objects can retain a stale matrix_world. Channels still evaluate.
        matrix = Matrix.LocRotScale(obj.location, obj.rotation_euler.to_quaternion(), obj.scale)
        vertices = [matrix @ v.co for v in obj.data.vertices]
        return {'name': obj.name, 'role': roles[obj.name], 'hidden': obj.hide_render,
                'vertices': [list(v) for v in vertices],
                'screen': [list(world_to_camera_view(scene, camera, v)) for v in vertices]}
    oracle.append({'frame': frame, 'planes': [
        evaluated(obj)
        for obj in scene.objects if obj.name in roles]})
report = Path('/home/liveuser/Documents/pix3lware-theme/transition-reference')
report.mkdir(exist_ok=True, parents=True)
(report/'blender-evaluated-frames.json').write_text(json.dumps(oracle))
print(json.dumps({'frames': sorted(all_key_frames), 'end': end,
                  'curves': sum(len(p['curves']) for p in planes), 'oracleSamples': len(oracle)}))
