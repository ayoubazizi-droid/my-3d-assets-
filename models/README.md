The live `Ud.glb` was rebuilt on 2026-09-14 from
`/home/liveuser/Documents/ford bronco.blend`.

The export contains 26 assembly objects, 51 materials, embedded PBR textures,
and 458,882 rendered triangles. Matching wheels share geometry and textures.
The body uses 2048px baked maps; other baked surfaces use 1024px maps.
Normal maps remain lossless. File size: 30,108,516 bytes.
Khronos glTF Validator reports zero errors and zero warnings.

The viewer now loads `Ud-optimized.glb` (23,662,592 bytes), using
`EXT_meshopt_compression` and the vendored Meshoptimizer 0.20 decoder.
All decoded vertex and index buffers are checked byte-for-byte against `Ud.glb`;
textures and material settings are copied unchanged. No geometry is simplified
or quantized. The original remains available and is used without WebAssembly.
The standard validator reports zero errors/warnings on the compressed file;
it does not inspect this extension, so decoder round trips and real Three.js
rendering provide the additional compression checks.

The separate baked Blender file, texture maps, validation report, and previews
are in `/home/liveuser/Documents/ford-bronco-web-20260914/`.
The source Blender file is never overwritten.

Rebuild using Blender in this order: `scripts/bake-bronco.py` on the source,
`scripts/finalize-bronco.py` on the generated `Ud-baked.blend`, then
`scripts/optimize-bronco.py`. Choose a fresh output directory when the source
changes. Validate and preview the resulting GLB before replacing the live file.

After rebuilding the original, regenerate its compressed copy with:

```
MESHOPT_MODULE=/path/to/node_modules/meshoptimizer node scripts/compress-model.cjs models/Ud.glb models/Ud-optimized.glb
```

Use Meshoptimizer 0.20.0 to match the shipped decoder. The script verifies each
compressed buffer by decoding it and comparing the original bytes before saving.

Place other .glb models here and set their URLs in ../app.js, for example:

url: './models/sculpture.glb'

Use a self-contained GLB with embedded textures and no Draco or KTX2 compression.
External .gltf files also work if you upload every referenced texture and .bin file
and preserve their relative paths. This starter displays the model's static pose.
