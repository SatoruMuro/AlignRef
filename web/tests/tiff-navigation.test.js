import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeTiff } from '../src/tiff.js';
import { wheelNavigation } from '../src/navigation.js';
import { isImageFile } from '../src/source.js';
const fixture=async name=>new Uint8Array(await readFile(new URL('./fixtures/tiff/'+name,import.meta.url)));
function tag(bytes,id,value){const copy=bytes.slice(),v=new DataView(copy.buffer);for(let i=0;i<v.getUint16(8,true);i++){const at=10+i*12;if(v.getUint16(at,true)===id){v.setUint16(at+8,value,true);return copy;}}throw new Error('missing tag');}
test('8-bit grayscale TIFF uncompressed and WhiteIsZero yield exact RGBA pixels',async()=>{
 const d=decodeTiff(await fixture('probe-gray8-white.tif'));
 assert.equal(d.source.bitDepth,8);assert.equal(d.width,3);assert.equal(d.height,2);
 assert.deepEqual([...d.rgba],[255,255,255,255,254,254,254,255,191,191,191,255,127,127,127,255,1,1,1,255,0,0,0,255]);
});
test('big-endian RGB16 LZW with predictor 2 converts known integer samples to 8-bit',async()=>{
 const d=decodeTiff(await fixture('probe-rgb16-big-lzw.tiff'));
 assert.equal(d.source.bitDepth,16);assert.equal(d.source.compression,5);
 assert.deepEqual([...d.rgba],[0,1,255,255,255,128,0,255,48,91,135,255,255,255,255,255]);
});
test('legacy Deflate and predictor 2 preserve expected grayscale samples',async()=>{
 const d=decodeTiff(await fixture('probe-gray8-deflate.tif'));
 assert.deepEqual([...d.rgba].filter((_,i)=>i%4===0),[0,1,64,128,254,255]);
});
test('all synthetic stack TIFF variants decode without changing original bytes',async()=>{
 for(const name of ['slice1-gray8.tif','slice2-rgb8-lzw.tif','slice3-gray16-deflate.tiff']){
   const b=await fixture(name),before=b.slice(),d=decodeTiff(b);assert.deepEqual(b,before);
   assert.equal(d.width,256);assert.equal(d.height,192);assert.equal(d.rgba.length,256*192*4);
   assert.equal(d.source.representationBitDepth,8);
 }
});
test('unsupported TIFF layouts and corrupt/oversized inputs fail explicitly',async()=>{
 const b=await fixture('probe-gray8-white.tif');
 for(const [id,value,pattern] of [[259,32773,/compression/],[284,2,/Planar/],[274,3,/orientation/],[339,2,/unsigned/],[262,3,/grayscale or RGB/],[277,2,/grayscale or RGB/]])
  assert.throws(()=>decodeTiff(tag(b,id,value)),pattern);
 const multi=b.slice(),v=new DataView(multi.buffer);v.setUint32(10+v.getUint16(8,true)*12,8,true);
 assert.throws(()=>decodeTiff(multi),/Multi-page/);
 assert.throws(()=>decodeTiff(b.slice(0,25)));
 const wide=tag(b,256,32768);assert.throws(()=>decodeTiff(wide),/canvas limit/);
});
test('image filter includes .tif/.tiff case-insensitively without accepting unrelated files',()=>{
 for(const name of ['a.tif','b.TIFF','c.png','D.JPEG'])assert.equal(isImageFile({name}),true);
 assert.equal(isImageFile({name:'a.tiff.exe'}),false);
});
test('wheel bursts move once immediately, inertia extends debounce, and direction follows a new burst',()=>{
 const step=wheelNavigation();assert.equal(step(100,0),1);
 for(let t=10;t<=200;t+=10)assert.equal(step(100,t),0);
 assert.equal(step(-100,379),0);assert.equal(step(-100,560),-1);
 assert.equal(step(0,570),0);assert.equal(step(1,750),1);
});
