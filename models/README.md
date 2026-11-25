# Betrayer web model

`Betrayer.blend` is the Blender source scene. `Betrayer.glb` is the static,
self-contained model used by the web viewer.

The GLB keeps the character, body mesh, and equipped sword. Its baked 1024 px
PBR textures are embedded in the file, so the browser makes one model request
without fetching separate texture files. The export has 36,498 triangles and
is about 5.2 MiB.

Rebuild the web model from the source with Blender 5.2 or later:

```sh
blender -b --python scripts/prepare-betrayer.py
```

The export is a static pose. Cameras, lights, scenery, rain effects, duplicate
attachment meshes, and the armature are excluded from the GLB.
