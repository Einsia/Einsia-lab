// Requires @gltf-transform/{core,extensions,functions} and draco3dgltf.
// Usage: node export-optimize.mjs source.glb target.glb
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,join,draco,quantize} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import fs from 'node:fs/promises';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,dst]=process.argv.slice(2);const doc=await io.read(src);
await doc.transform(dedup(),quantize({quantizeColor:8,quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}),weld(),join(),prune(),draco({encodeSpeed:0,decodeSpeed:5,quantizeColor:6,quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}));
await io.write(dst,doc);console.log(src,'=>',(await fs.stat(dst)).size);
