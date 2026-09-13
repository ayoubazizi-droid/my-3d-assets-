import bpy, json
s=bpy.context.scene
report={'scene':s.name,'frames':[s.frame_start,s.frame_end],'fps':s.render.fps/s.render.fps_base,'engine':s.render.engine,'resolution':[s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage],'camera':s.camera.name if s.camera else None,'world':s.world.name if s.world else None,'objects':[], 'materials':[], 'images':[]}
for o in s.objects:
 report['objects'].append({'name':o.name,'type':o.type,'hide_render':o.hide_render,'location':list(o.location),'dimensions':list(o.dimensions),'modifiers':[(m.name,m.type) for m in o.modifiers],'action':o.animation_data.action.name if o.animation_data and o.animation_data.action else None,'materials':[m.name if m else None for m in o.data.materials] if hasattr(o.data,'materials') else []})
for m in bpy.data.materials:
 report['materials'].append({'name':m.name,'nodes':[(n.name,n.type) for n in m.node_tree.nodes] if m.node_tree else []})
for i in bpy.data.images:
 report['images'].append({'name':i.name,'path':i.filepath,'packed':bool(i.packed_file),'size':list(i.size)})
report['actions']=[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions]
report['world_nodes']=[(n.name,n.type) for n in s.world.node_tree.nodes] if s.world and s.world.node_tree else []
print('LOADER_REPORT '+json.dumps(report))
