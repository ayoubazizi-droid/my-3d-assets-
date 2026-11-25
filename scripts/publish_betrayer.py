"""Bake Betrayer.blend, swap it in for the Ford Bronco, commit and push.

    blender -b --python-exit-code 1 --python publish_betrayer.py

Options go after "--":
    --blend PATH        source file (default ~/Downloads/Betrayer.blend)
    --objects "A,B"     export exactly these mesh objects
    --size 2048         baked texture size
    --triangles 150000  triangle budget
    --no-source         do not commit the .blend (the repository is public)

The source .blend is never saved over. Nothing is pushed until you confirm.
"""
import argparse
import hashlib
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

REPO = "https://github.com/ayoubazizi-droid/my-3d-assets-.git"
EXTRAS = re.compile(
    r"water|ocean|rain|splash|droplet|stone|rock|ground|floor|plane|sky|fog|"
    r"volume|particle|emitter|helper|widget|^wgt|^cs_", re.I)
OLD_VERSION = "enter-20260917-v34"
NEW_VERSION = "betrayer-20261125-v35"

# Order matters: longer phrases first.
TEXT = [
    ("Interactive Ford Bronco Raptor viewer", "Interactive Betrayer viewer"),
    ("Interactive Ford Bronco Raptor", "Interactive Betrayer model"),
    ("Our custom Ford Bronco Raptor.", "Our custom Betrayer character."),
    ("Ford Bronco Raptor", "Betrayer"),
    ("Loading the Ford Bronco", "Loading Betrayer"),
    ("Loading the Bronco", "Loading Betrayer"),
    ("Preparing the Bronco", "Preparing Betrayer"),
    ("Still preparing your Bronco", "Still preparing Betrayer"),
    ("Bronco could not load", "Betrayer could not load"),
    ("EXPLORE THE BRONCO", "EXPLORE THE BETRAYER"),
    ("Interactive Bronco gallery", "Interactive Betrayer gallery"),
    ("01 / CUSTOM BRONCO", "01 / THE BETRAYER"),
    (OLD_VERSION, NEW_VERSION),
]
TEXT_FILES = ["index.html", "viewer.html", "app.js", "motion.js", "theme.css",
              "blogger-theme.xml", "blogger-embed.html", "scripts/sync-motion.py"]


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit(f"app.js changed since this script was written: {old!r}")
    return text.replace(old, new)


def update_site(repo, glb_tag):
    app = repo / "app.js"
    s = app.read_text(encoding="utf-8")
    s = replace_once(s, "./models/Ud.glb?v=bronco-20260914-v10",
                     f"./models/Betrayer.glb?v={glb_tag}")
    # A standing character needs more room than a car, centred on its middle.
    s = replace_once(s, "wrap.clientWidth < 600 ? 4.6 : 3.55",
                     "wrap.clientWidth < 600 ? 5.2 : 4.5")
    s = replace_once(s, "controls.target.set(0, -0.28, 0);",
                     "controls.target.set(0, 0, 0);")
    s = replace_once(s, "// Closer framing on wide screens; preserve space around the car on phones.",
                     "// Frame the full height of the character, with extra room on phones.")
    s = replace_once(s, "// Let the orbit travel beneath the chassis for the requested underside shot.\n", "")
    s = replace_once(s, "// Derived from /home/liveuser/Documents/ford bronco.blend: the camera sits\n"
                        "// at the floor line and looks toward the wheel center, without going under it.\n",
                     "// Keep the camera from travelling under the character.\n")
    # Forget any camera angle that was locked while viewing the Bronco.
    s = s.replace("pix3lware-max-polar-v2", "pix3lware-max-polar-v3")
    app.write_text(s, encoding="utf-8")

    for name in TEXT_FILES:
        path = repo / name
        s = path.read_text(encoding="utf-8")
        for old, new in TEXT:
            s = s.replace(old, new)
        path.write_text(s, encoding="utf-8")

    (repo / "models/README.md").write_text(
        "The live `Betrayer.glb` is built from `Betrayer.blend` with\n"
        "`scripts/publish_betrayer.py` (static pose, baked PBR textures).\n",
        encoding="utf-8")
    (repo / "models/Ud.glb").unlink(missing_ok=True)


def run(*cmd, cwd=None):
    print("$", " ".join(map(str, cmd)), flush=True)
    subprocess.run(list(map(str, cmd)), cwd=cwd, check=True)


# ---------------------------------------------------------------- Blender part

def choose_objects(requested):
    import bpy
    meshes = [o for o in bpy.context.scene.objects
              if o.type == "MESH" and len(o.data.polygons)]
    if requested:
        names = [n.strip() for n in requested.split(",")]
        missing = set(names) - {o.name for o in meshes}
        if missing:
            raise SystemExit(f"No such mesh objects: {sorted(missing)}")
        return [o for o in meshes if o.name in names]
    shapes = {b.custom_shape for a in bpy.context.scene.objects if a.type == "ARMATURE"
              for b in a.pose.bones if b.custom_shape}
    while True:
        chosen = [o for o in meshes if not o.hide_render and o.visible_get()
                  and o not in shapes and not EXTRAS.search(o.name)]
        print("\nWILL EXPORT:")
        for o in chosen:
            print(f"  {o.name}  ({len(o.data.polygons)} faces)")
        print("SKIPPING:", ", ".join(o.name for o in meshes if o not in chosen) or "nothing")
        answer = input("\nPress Enter to accept, or type the exact names to export "
                       "(comma separated): ").strip()
        if not answer:
            if not chosen:
                raise SystemExit("Nothing selected. Run again and type the object names.")
            return chosen
        return choose_objects(answer)


def static_copies(sources):
    """Freeze the current pose and modifiers into plain meshes."""
    import bpy
    for o in sources:
        for m in o.modifiers:
            if m.type == "SUBSURF":
                m.levels = m.render_levels = min(m.render_levels, 1)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    frozen = []
    for o in sources:
        evaluated = o.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(
            evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        frozen.append((o.name, mesh, evaluated.matrix_world.copy(),
                       [s.material for s in evaluated.material_slots]))
    # Take the originals out of the scene; their data stays for texture references.
    scene = bpy.context.scene
    for o in list(scene.objects):
        for collection in o.users_collection:
            collection.objects.unlink(o)
    result = []
    for name, mesh, matrix, materials in frozen:
        copy = bpy.data.objects.new(name + "_web", mesh)
        scene.collection.objects.link(copy)
        copy.matrix_world = matrix
        if not materials:
            mesh.materials.append(None)
            materials = [None]
        for i, material in enumerate(materials):
            if material:
                material = material.original.copy()
            else:
                material = bpy.data.materials.new("Default")
            material.use_nodes = True
            copy.material_slots[i].link = "OBJECT"
            copy.material_slots[i].material = material
        result.append(copy)
    return result


def activate(obj):
    import bpy
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj, kind, **settings):
    import bpy
    activate(obj)
    modifier = obj.modifiers.new(kind, kind)
    for key, value in settings.items():
        setattr(modifier, key, value)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def find_principled(socket):
    """Follow reroutes and mix/add shaders back to a Principled BSDF."""
    if not socket.is_linked:
        return None
    node = socket.links[0].from_node
    if node.type == "BSDF_PRINCIPLED":
        return node
    if node.type == "REROUTE":
        return find_principled(node.inputs[0])
    if node.type in ("MIX_SHADER", "ADD_SHADER"):
        for item in node.inputs:
            if item.type == "SHADER":
                found = find_principled(item)
                if found:
                    return found
    return None


def bake_object(obj, size):
    import bpy
    import numpy as np
    activate(obj)
    layers = obj.data.uv_layers
    original_uv = next((u.name for u in layers if u.active_render), None)
    if len(layers) >= 8:
        raise SystemExit(f"{obj.name}: no free UV slot for baking")
    layers.new(name="WebUV")
    layers.active = layers["WebUV"]
    if original_uv:
        layers[original_uv].active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.005)
    bpy.ops.object.mode_set(mode="OBJECT")
    layers = obj.data.uv_layers  # edit mode invalidates the earlier reference

    materials = [s.material for s in obj.material_slots]
    graphs = []
    for m in materials:
        out = m.node_tree.get_output_node("CYCLES")
        if out is None or not out.inputs["Surface"].is_linked:
            raise SystemExit(f"Material {m.name!r} has no connected surface output")
        graphs.append((m.node_tree, out, find_principled(out.inputs["Surface"])))
    simple = all(p for _, _, p in graphs)
    if not simple:
        print(f"WARNING {obj.name}: node-group or custom shader; using Blender's "
              "diffuse bake (metal areas may look dark). Check the preview.")

    def bake(label, srgb, socket=None, kind="EMIT"):
        image = bpy.data.images.new(f"{obj.name}_{label}", size, size, alpha=False)
        image.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
        temporary = []
        for tree, out, p in graphs:
            target = tree.nodes.new("ShaderNodeTexImage")
            target.image = image
            for node in tree.nodes:
                node.select = False
            target.select = True
            tree.nodes.active = target
            surface = out.inputs["Surface"].links[0].from_socket
            emission = None
            if socket:  # route one Principled input through an emission shader
                emission = tree.nodes.new("ShaderNodeEmission")
                source = p.inputs[socket]
                if source.is_linked:
                    tree.links.new(source.links[0].from_socket, emission.inputs["Color"])
                else:
                    value = source.default_value
                    color = tuple(value) if hasattr(value, "__len__") else (value,) * 3 + (1,)
                    emission.inputs["Color"].default_value = color
                if socket == "Emission Color":
                    strength = p.inputs["Emission Strength"]
                    if strength.is_linked:
                        tree.links.new(strength.links[0].from_socket, emission.inputs["Strength"])
                    else:
                        emission.inputs["Strength"].default_value = min(strength.default_value, 1.0)
                tree.links.new(emission.outputs[0], out.inputs["Surface"])
            temporary.append((tree, out, surface, target, emission))
        print(f"BAKE {obj.name} {label}", flush=True)
        options = {"type": kind, "uv_layer": "WebUV", "margin": 8, "use_clear": True,
                   "use_selected_to_active": False, "target": "IMAGE_TEXTURES",
                   "normal_space": "TANGENT"}
        if kind == "DIFFUSE":
            options["pass_filter"] = {"COLOR"}
        bpy.ops.object.bake(**options)
        for tree, out, surface, target, emission in temporary:
            tree.links.new(surface, out.inputs["Surface"])
            tree.nodes.remove(target)
            if emission:
                tree.nodes.remove(emission)
        image.pack()  # without this the exporter can write a blank texture
        pixels = np.empty(size * size * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        rgb = pixels.reshape(-1, 4)[:, :3]
        print(f"  mean={rgb.mean():.4f} max={rgb.max():.4f}")
        return image, pixels

    def used(socket, neutral):
        return any(p.inputs[socket].is_linked or p.inputs[socket].default_value != neutral
                   for _, _, p in graphs)

    if simple:
        albedo, albedo_px = bake("Albedo", True, "Base Color")
        _, rough = bake("Roughness", False, "Roughness")
        _, metal = bake("Metallic", False, "Metallic")
        glows = any(p.inputs["Emission Strength"].is_linked or
                    p.inputs["Emission Strength"].default_value > 0 for _, _, p in graphs)
        glow = bake("Emission", True, "Emission Color") if glows else None
        alpha = bake("Alpha", False, "Alpha") if used("Alpha", 1.0) else None
    else:
        albedo, albedo_px = bake("Albedo", True, kind="DIFFUSE")
        _, rough = bake("Roughness", False, kind="ROUGHNESS")
        metal = np.zeros_like(rough)
        glow = bake("Emission", True)
        alpha = None
    normal, _ = bake("Normal", False, kind="NORMAL")

    lit = albedo_px.reshape(-1, 4)[:, :3].max()
    if glow:
        lit = max(lit, glow[1].reshape(-1, 4)[:, :3].max())
    if lit < 0.02:
        names = {m.name: sorted({n.type for n in m.node_tree.nodes}) for m in materials}
        raise SystemExit(f"{obj.name} baked black, so nothing was published.\n"
                         f"Send this to get it fixed: {names}")

    if alpha:
        albedo = bpy.data.images.new(f"{obj.name}_AlbedoAlpha", size, size, alpha=True)
        albedo_px[3::4] = alpha[1][0::4]
        albedo.pixels.foreach_set(albedo_px)
        albedo.update()
        albedo.pack()

    # glTF layout: roughness in green, metallic in blue.
    packed = np.ones_like(rough)
    packed[1::4] = rough[0::4]
    packed[2::4] = metal[0::4]
    orm = bpy.data.images.new(f"{obj.name}_MetalRough", size, size, alpha=False)
    orm.colorspace_settings.name = "Non-Color"
    orm.pixels.foreach_set(packed)
    orm.update()
    orm.pack()

    web = bpy.data.materials.new(obj.name + "_baked")
    web.use_nodes = True
    tree = web.node_tree
    shader = tree.nodes.get("Principled BSDF")

    def texture(image):
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        uv = tree.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "WebUV"
        tree.links.new(uv.outputs[0], node.inputs["Vector"])
        return node

    base = texture(albedo)
    tree.links.new(base.outputs["Color"], shader.inputs["Base Color"])
    if alpha:
        # A rounding node makes the exporter use cut-out (MASK) transparency.
        cut = tree.nodes.new("ShaderNodeMath")
        cut.operation = "ROUND"
        tree.links.new(base.outputs["Alpha"], cut.inputs[0])
        tree.links.new(cut.outputs[0], shader.inputs["Alpha"])
    split = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(texture(orm).outputs["Color"], split.inputs[0])
    tree.links.new(split.outputs["Green"], shader.inputs["Roughness"])
    tree.links.new(split.outputs["Blue"], shader.inputs["Metallic"])
    bump = tree.nodes.new("ShaderNodeNormalMap")
    bump.uv_map = "WebUV"
    tree.links.new(texture(normal).outputs["Color"], bump.inputs["Color"])
    tree.links.new(bump.outputs[0], shader.inputs["Normal"])
    if glow:
        tree.links.new(texture(glow[0]).outputs["Color"], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = 1.0
    web.use_backface_culling = False
    for slot in obj.material_slots:
        slot.material = web
    obj.data.polygons.foreach_set("material_index", [0] * len(obj.data.polygons))
    for name in [u.name for u in layers if u.name != "WebUV"]:
        layers.remove(layers[name])
    layers["WebUV"].active_render = True


def build_glb(args, glb):
    import bpy
    bpy.ops.wm.open_mainfile(filepath=str(args.blend), load_ui=False)
    missing = [i.name for i in bpy.data.images
               if i.source == "FILE" and not i.packed_file
               and not Path(bpy.path.abspath(i.filepath)).exists()]
    if missing:
        print("WARNING missing texture files:", ", ".join(missing))
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    objects = static_copies(choose_objects(args.objects))
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    total = sum(len(p.vertices) - 2 for o in objects for p in o.data.polygons)
    ratio = min(1.0, args.triangles / total)
    for o in objects:
        apply_modifier(o, "TRIANGULATE")
        if ratio < 1:
            apply_modifier(o, "DECIMATE", ratio=ratio)
    for o in objects:
        bake_object(o, args.size)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(glb), export_format="GLB", use_selection=True,
        export_animations=False, export_cameras=False,
        export_lights=False, export_tangents=True, export_image_format="AUTO")


def render_preview(glb, png):
    """Render the exported file itself, so the check shows what visitors get."""
    import bpy
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    scene = bpy.context.scene
    points = [o.matrix_world @ Vector(c) for o in scene.objects
              if o.type == "MESH" for c in o.bound_box]
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    centre, extent = (low + high) / 2, max(high - low)
    camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.25
    camera.data.clip_end = extent * 20
    direction = Vector((0.55, -1, 0.3)).normalized()
    camera.location = centre + direction * extent * 4
    camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3
    sun.rotation_euler = (0.8, 0.2, 0.5)
    scene.collection.objects.link(sun)
    scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.5, 0.5, 0.55, 1)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.filepath = str(png)
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", type=Path,
                        default=Path.home() / "Downloads/Betrayer.blend")
    parser.add_argument("--objects")
    parser.add_argument("--size", type=int, default=2048)
    parser.add_argument("--triangles", type=int, default=150000)
    parser.add_argument("--no-source", action="store_true")
    args = parser.parse_args(argv)
    args.blend = args.blend.expanduser().resolve()
    if not args.blend.is_file():
        raise SystemExit(f"Not found: {args.blend}")

    work = Path.home() / "betrayer-web" / time.strftime("%Y%m%d-%H%M%S")
    repo = work / "repo"
    work.mkdir(parents=True)
    run("git", "clone", "--branch", "main", REPO, repo)
    glb, preview = work / "Betrayer.glb", work / "preview.png"
    build_glb(args, glb)
    render_preview(glb, preview)

    digest = hashlib.sha256(glb.read_bytes()).hexdigest()[:10]
    update_site(repo, digest)
    shutil.copy2(glb, repo / "models/Betrayer.glb")
    if not args.no_source:
        shutil.copy2(args.blend, repo / "models/Betrayer.blend")
    shutil.copy2(Path(__file__).resolve(), repo / "scripts/publish_betrayer.py")
    run("git", "add", "-A", cwd=repo)
    run("git", "commit", "-m", "Replace the Ford Bronco with Betrayer", cwd=repo)
    run("git", "--no-pager", "show", "--stat", "HEAD", cwd=repo)

    print(f"\nModel: {glb.stat().st_size / 1e6:.1f} MB\nLOOK AT THIS PREVIEW: {preview}")
    answer = input("\nType 'live' to update the website (main), 'branch' to push a "
                   "review branch, or press Enter to stop: ").strip().lower()
    if answer == "live":
        run("git", "push", "origin", "main", cwd=repo)
    elif answer == "branch":
        run("git", "push", "origin", f"HEAD:refs/heads/betrayer-{work.name}", cwd=repo)
    else:
        print(f"Not pushed. The commit is waiting in {repo}")


if __name__ == "__main__":
    main()
