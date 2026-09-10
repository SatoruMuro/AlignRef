import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { fileURLToPath } from 'node:url';
const asset=name=>fileURLToPath(new URL('../tests/fixtures/tiff/'+name,import.meta.url));
const stack=['slice1-gray8.tif','slice2-rgb8-lzw.tif','slice3-gray16-deflate.tiff'].map(asset);
async function download(page,id){const pending=page.waitForEvent('download');await page.locator('#'+id).click();return readFile(await(await pending).path());}
const manifest=async page=>JSON.parse((await download(page,'export-transforms')).toString());
async function overViewer(page){await page.locator('#viewer').focus();await page.locator('#viewer').hover();await page.waitForTimeout(220);}
function audit(page){const log={errors:[],http:[],uploads:[],external:[],websockets:[]};
 page.on('pageerror',e=>log.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')log.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)log.http.push(r.url());});
 page.on('websocket',s=>log.websockets.push(s.url()));
 page.on('request',r=>{if(/^https?:/.test(r.url())){
  if(r.method()!=='GET'&&r.method()!=='HEAD'||r.postDataBuffer())log.uploads.push(r.method()+' '+r.url());
  if(new URL(r.url()).origin!==new URL(process.env.ALIGNREF_BASE_URL||'http://127.0.0.1:4173').origin)log.external.push(r.url());
 }});return log;
}
test('TIFF local workflow: F/R, wheel gestures and boundaries, explicit reversed range, rigid/manual/export without uploads',async({page},info)=>{
 const log=audit(page);await page.goto('./');
 await expect(page.locator('.local-privacy')).toBeVisible();await expect(page.locator('.local-privacy')).toContainText('not uploaded to any server');
 await expect(page.locator('.navigation-hint')).toContainText('R');await expect(page.locator('.navigation-hint')).toContainText('F');
 await page.locator('#files').setInputFiles(stack);
 await expect(page.locator('#status')).toContainText('Loaded 3 images');
 await expect(page.locator('#position-start')).toHaveText('—');await expect(page.locator('#position-end')).toHaveText('—');
 const original=await manifest(page);expect(original.slices.map(s=>s.source.bitDepth)).toEqual([8,8,16]);expect(original.dataset).toBeNull();
 await overViewer(page);await page.keyboard.press('f');await expect(page.locator('#slice')).toHaveValue('3');
 await page.keyboard.press('r');await expect(page.locator('#slice')).toHaveValue('2');
 await page.mouse.wheel(0,100);await expect(page.locator('#slice')).toHaveValue('3');
 await overViewer(page);await page.mouse.wheel(0,100);await expect(page.locator('#slice')).toHaveValue('3');
 await overViewer(page);await page.mouse.wheel(0,-100);await expect(page.locator('#slice')).toHaveValue('2');
 await overViewer(page);await page.mouse.wheel(0,-100);await expect(page.locator('#slice')).toHaveValue('1');
 await overViewer(page);await page.mouse.wheel(0,-100);await expect(page.locator('#slice')).toHaveValue('1');
 await overViewer(page);
 await page.locator('#viewer').evaluate(el=>{for(let i=0;i<30;i++)el.dispatchEvent(new WheelEvent('wheel',{deltaY:60,bubbles:true,cancelable:true}));});
 await expect(page.locator('#slice')).toHaveValue('2');
 await overViewer(page);const z=await page.locator('#zoom').textContent();await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');
 await expect(page.locator('#zoom')).not.toHaveText(z);await expect(page.locator('#slice')).toHaveValue('2');
 await page.locator('#slice').focus();await page.locator('#viewer').hover();await page.mouse.wheel(0,100);await page.waitForTimeout(220);await expect(page.locator('#slice')).toHaveValue('2');
 await page.locator('#channel').focus();await page.locator('#viewer').hover();await page.mouse.wheel(0,100);await page.waitForTimeout(220);await expect(page.locator('#slice')).toHaveValue('2');
 await page.locator('#opacity').focus();await page.locator('#viewer').hover();await page.mouse.wheel(0,100);await page.waitForTimeout(220);await expect(page.locator('#slice')).toHaveValue('2');
 await page.locator('#load-section').hover();await page.mouse.wheel(0,100);await page.waitForTimeout(220);await expect(page.locator('#slice')).toHaveValue('2');
 await page.locator('#channel').selectOption('Green');await page.locator('#register').click();
 await expect(page.locator('#status')).toContainText('Rigid registration complete',{timeout:90000});
 const registered=await manifest(page);
 for(const [i,dx,dy]of[[0,-6,4],[2,5,-3]]){
   const m=registered.slices[i].automaticTransform;expect(m.every(Number.isFinite)).toBe(true);
   expect(Math.abs(m[4]-dx)).toBeLessThan(1.2);expect(Math.abs(m[5]-dy)).toBeLessThan(1.2);expect(registered.slices[i].qc.score).toBeGreaterThan(.98);
 }
 await page.locator('#record').click();await page.keyboard.press('d');await page.locator('#viewer').hover();await page.mouse.wheel(0,100);
 await expect(page.locator('#slice')).toHaveValue('2');await page.locator('#finish').click();
 await overViewer(page);await page.keyboard.press('f');await page.locator('#range-start').click();
 await expect(page.locator('#position-start')).toHaveText('3 ✓');await expect(page.locator('#range-start')).toHaveClass(/position-set/);
 await expect(page.locator('#status')).toHaveText('Start position set to slice 3');
 await overViewer(page);await page.keyboard.press('r');await page.keyboard.press('r');await page.locator('#range-end').click();
 await expect(page.locator('#position-end')).toHaveText('1 ✓');await expect(page.locator('#range-end')).toHaveClass(/position-set/);
 await expect(page.locator('#status')).toHaveText('End position set to slice 1');
 await expect(page.locator('#range')).toContainText('Apply to slices 1–3');await expect(page.locator('#range')).toContainText('Start > End');
 await page.screenshot({path:info.outputPath('tiff-range-navigation.png')});
 await page.locator('#apply-range').click();const refined=await manifest(page);expect(refined.slices.every(s=>s.manualTransform[4]===1)).toBe(true);
 const zip=unzipSync(await download(page,'export-zip'));expect(Object.keys(zip).filter(n=>n.endsWith('.png'))).toHaveLength(3);
 expect(zip['DATA_LICENSE.md']).toBeUndefined();
 expect(log).toEqual({errors:[],http:[],uploads:[],external:[],websockets:[]});
 await info.attach('privacy-network',{body:JSON.stringify(log),contentType:'application/json'});
});

test('RGB16 TIFF exports exact 8-bit pixels; unsupported input leaves the prior stack unchanged',async({page})=>{
 const log=audit(page);await page.goto('./');await page.locator('#files').setInputFiles(asset('probe-rgb16-big-lzw.tiff'));
 await expect(page.locator('#status')).toContainText('Loaded 1 images');
 const before=await manifest(page);expect(before.slices[0].source.bitDepth).toBe(16);
 const zip=unzipSync(await download(page,'export-zip'));
 const rgba=await page.evaluate(async data=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]));const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d');ctx.drawImage(b,0,0);const pixels=[...ctx.getImageData(0,0,2,2).data];b.close();return pixels;},Buffer.from(zip['probe-rgb16-big-lzw.png']).toString('base64'));
 expect(rgba).toEqual([0,1,255,255,255,128,0,255,48,91,135,255,255,255,255,255]);
 const invalid=await readFile(asset('probe-gray8-white.tif'));for(let i=0;i<invalid.readUInt16LE(8);i++){const at=10+i*12;if(invalid.readUInt16LE(at)===259)invalid.writeUInt16LE(32773,at+8);}
 await page.locator('#files').setInputFiles({name:'unsupported.tif',mimeType:'image/tiff',buffer:invalid});
 await expect(page.locator('#status')).toContainText('PackBits/JPEG/CCITT are not supported');
 expect((await manifest(page)).slices).toEqual(before.slices);await expect(page.locator('#record')).toBeEnabled();
 expect(log).toEqual({errors:[],http:[],uploads:[],external:[],websockets:[]});
});
