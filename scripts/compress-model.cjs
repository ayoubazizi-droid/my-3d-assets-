// Lossless buffer compression; keeps vertex values, index order and textures intact.
// MESHOPT_MODULE=/path/to/meshoptimizer node scripts/compress-model.cjs input.glb output.glb
const fs = require('node:fs'), assert = require('node:assert/strict');
const {MeshoptEncoder,MeshoptDecoder} = require(process.env.MESHOPT_MODULE || 'meshoptimizer');
(async () => {
  const [input,output] = process.argv.slice(2);
  if (!input || !output || input === output) throw Error('Use separate input and output GLB files');
  await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
  const source = fs.readFileSync(input), jsonLength = source.readUInt32LE(12);
  assert.equal(source.readUInt32LE(0),0x46546c67);
  const gltf = JSON.parse(source.subarray(20,20+jsonLength));
  assert.equal(gltf.buffers.length,1);
  const binary = source.subarray(28+jsonLength), chunks = [];
  let offset = 0, fallbackOffset = 0, compressedViews = 0;
  function append(bytes) {
    const padding = (4-offset%4)%4;
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    const start = offset;
    chunks.push(Buffer.from(bytes)); offset += bytes.length;
    return start;
  }
  for (const [index,view] of gltf.bufferViews.entries()) {
    assert.equal(view.buffer,0);
    const raw = binary.subarray(view.byteOffset || 0,(view.byteOffset || 0)+view.byteLength);
    const accessors = gltf.accessors.filter(a=>a.bufferView===index);
    if (!accessors.length) { view.byteOffset = append(raw); continue; }
    assert.equal(accessors.length,1,'Expected separate attribute buffers');
    const count = accessors[0].count, stride = view.byteLength/count;
    const mode = view.target===34963 ? 'INDICES' : 'ATTRIBUTES';
    const encoded = MeshoptEncoder.encodeGltfBuffer(raw,count,stride,mode);
    const decoded = new Uint8Array(raw.length);
    MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,encoded,mode);
    assert.ok(Buffer.from(decoded).equals(raw),`Exact decode failed for bufferView ${index}`);
    if (encoded.length >= raw.length) { view.byteOffset = append(raw); continue; }
    fallbackOffset = (fallbackOffset+3)&~3;
    view.buffer = 1; view.byteOffset = fallbackOffset; fallbackOffset += raw.length;
    view.extensions = {...view.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:append(encoded),byteLength:encoded.length,byteStride:stride,count,mode}};
    compressedViews++;
  }
  gltf.buffers = [{byteLength:offset},{byteLength:fallbackOffset,extensions:{EXT_meshopt_compression:{fallback:true}}}];
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed||[]),'EXT_meshopt_compression'])];
  gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired||[]),'EXT_meshopt_compression'])];
  const json = Buffer.from(JSON.stringify(gltf)), jsonPadding = Buffer.alloc((4-json.length%4)%4,32);
  const bin = Buffer.concat([...chunks,Buffer.alloc((4-offset%4)%4)]);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4);
  header.writeUInt32LE(28+json.length+jsonPadding.length+bin.length,8);
  header.writeUInt32LE(json.length+jsonPadding.length,12); header.writeUInt32LE(0x4e4f534a,16);
  binHeader.writeUInt32LE(bin.length,0); binHeader.writeUInt32LE(0x004e4942,4);
  const result = Buffer.concat([header,json,jsonPadding,binHeader,bin]);
  assert.ok(result.length<source.length,'Compression must reduce download size');
  fs.writeFileSync(output,result);
  console.log(JSON.stringify({before:source.length,after:result.length,saved:source.length-result.length,compressedViews,verified:'Every decoded geometry buffer matches the original bytes'}));
})().catch(error=>{console.error(error);process.exit(1)});
