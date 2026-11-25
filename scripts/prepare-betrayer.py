#!/usr/bin/env python3
"""Bake the Betrayer model to a compact, self-contained web GLB."""

from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "models" / "Betrayer.blend"
OUTPUT = ROOT / "models" / "Betrayer.glb"
BAKE_CACHE = Path("/tmp/betrayer-baked-textures")
MODEL_OBJECTS = (
    "Betrayer_Mesh",
    "body_base_new_Mesh",
    "EV_Object_0_Mesh",
)


def set_target_image(material, image):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    for node in nodes:
        node.select = False
    target = nodes.new("ShaderNodeTexImage")
    target.image = image
    target.select = True
    nodes.active = target


def bake_object(obj, image, bake_type):
    for slot in obj.material_slots:
        if slot.material:
            set_target_image(slot.material, image)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.scene.cycles.bake_type = bake_type
    bpy.ops.object.bake(type=bake_type)


def make_metallic_bake_material(material, image):
    baked = material.copy()
    baked.name = f"{material.name} metallic bake"
    nodes = baked.node_tree.nodes
    links = baked.node_tree.links
    output = next((node for node in nodes if node.type == "OUTPUT_MATERIAL"), None)
    if output is None:
        output = nodes.new("ShaderNodeOutputMaterial")

    surface = output.inputs.get("Surface")
    source = surface.links[0].from_node if surface.is_linked else None
    principled = source if source and source.type == "BSDF_PRINCIPLED" else next(
        (node for node in nodes if node.type == "BSDF_PRINCIPLED"), None
    )
    metallic = principled.inputs.get("Metallic") if principled else None

    emission = nodes.new("ShaderNodeEmission")
    if metallic and metallic.is_linked:
        links.new(metallic.links[0].from_socket, emission.inputs["Color"])
    else:
        value = float(metallic.default_value) if metallic else 0.0
        emission.inputs["Color"].default_value = (value, value, value, 1.0)
    links.new(emission.outputs["Emission"], surface)
    set_target_image(baked, image)
    return baked


def bake_metallic(obj, image):
    original_materials = [slot.material for slot in obj.material_slots]
    for index, material in enumerate(original_materials):
        if material:
            obj.material_slots[index].material = make_metallic_bake_material(material, image)
    bake_object(obj, image, "EMIT")
    for index, material in enumerate(original_materials):
        obj.material_slots[index].material = material


def new_image(name, size, color_space):
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    image.colorspace_settings.name = color_space
    return image


def save_and_pack_images(obj, images):
    BAKE_CACHE.mkdir(parents=True, exist_ok=True)
    for image in images:
        image.filepath_raw = str(BAKE_CACHE / f"{obj.name}_{image.name.rsplit('_', 1)[-1]}.png")
        image.file_format = "PNG"
        image.save()
        image.pack()


def main():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.render.bake.margin = 16
    scene.render.bake.use_pass_color = True
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_clear = True

    models = []
    for name in MODEL_OBJECTS:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"Required model mesh not found: {name}")
        if obj.data.uv_layers:
            obj.data.uv_layers.active = next(
                (layer for layer in obj.data.uv_layers if layer.name == "automap"),
                obj.data.uv_layers.active,
            )
        models.append(obj)

    baked_maps = {}
    for obj in models:
        size = 1024
        albedo = new_image(f"{obj.name}_Albedo", size, "sRGB")
        normal = new_image(f"{obj.name}_Normal", size, "Non-Color")
        roughness = new_image(f"{obj.name}_Roughness", size, "Non-Color")
        metallic = new_image(f"{obj.name}_Metallic", size, "Non-Color")
        emission = new_image(f"{obj.name}_Emission", size, "sRGB")

        bake_object(obj, albedo, "DIFFUSE")
        bake_object(obj, normal, "NORMAL")
        bake_object(obj, roughness, "ROUGHNESS")
        bake_object(obj, emission, "EMIT")
        bake_metallic(obj, metallic)
        save_and_pack_images(obj, (albedo, normal, roughness, metallic, emission))
        baked_maps[obj.name] = (albedo, normal, roughness, metallic, emission)

    # Keep the posed character and its sword. Remove the source scene, duplicate
    # attachment meshes, and distant effects that distort the web viewer bounds.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated_meshes = []
    for obj in models:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        evaluated_meshes.append((obj, mesh, obj.matrix_world.copy()))

    keep = set(models)
    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)

    for obj, mesh, world_matrix in evaluated_meshes:
        obj.data = mesh
        obj.parent = None
        obj.matrix_world = world_matrix
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)

    for obj in models:
        albedo, normal, roughness, metallic, emission = baked_maps[obj.name]
        material = bpy.data.materials.new(f"{obj.name} baked PBR")
        material.use_nodes = True
        material.node_tree.nodes.clear()
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        output = nodes.new("ShaderNodeOutputMaterial")
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Roughness"].default_value = 0.75
        shader.inputs["Metallic"].default_value = 0.0
        links.new(shader.outputs["BSDF"], output.inputs["Surface"])

        def image_input(image, label, color_space):
            node = nodes.new("ShaderNodeTexImage")
            node.name = label
            node.label = label
            node.image = image
            node.interpolation = "Linear"
            node.image.colorspace_settings.name = color_space
            return node

        base_node = image_input(albedo, "Baked base color", "sRGB")
        rough_node = image_input(roughness, "Baked roughness", "Non-Color")
        metal_node = image_input(metallic, "Baked metallic", "Non-Color")
        normal_node = image_input(normal, "Baked tangent normal", "Non-Color")
        emission_node = image_input(emission, "Baked emission", "sRGB")
        normal_map = nodes.new("ShaderNodeNormalMap")
        links.new(base_node.outputs["Color"], shader.inputs["Base Color"])
        links.new(rough_node.outputs["Color"], shader.inputs["Roughness"])
        links.new(metal_node.outputs["Color"], shader.inputs["Metallic"])
        links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
        links.new(emission_node.outputs["Color"], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = 1.0
        obj.data.materials.clear()
        obj.data.materials.append(material)

    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = models[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_apply=True,
        export_image_format="AUTO",
        export_extras=False,
    )
    print(f"WEB_MODEL_EXPORTED {OUTPUT} {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
