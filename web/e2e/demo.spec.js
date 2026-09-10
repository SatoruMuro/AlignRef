import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { validRigid, point } from '../src/geometry.js';
async function download(page,id) {
  const pending=page.waitForEvent('download',{timeout:180000});
  await page.locator('#'+id).click();
  return readFile(await (await pending).path());
}
const transforms=async page=>JSON.parse((await download(page,'export-transforms')).toString());
async function load(page) {
  await page.locator('#load-demo').click();
  await expect(page.locator('#status')).toContainText('Loaded 132 images',{timeout:120000});
}
test('real 132-section demo: lazy load, rigid registration, QC, refinement, crop, PNG/JPEG export and normal reset',async({page,browserName},info)=>{
  test.setTimeout(900000);
  const log={errors:[],badResponses:[],failedRequests:[],external:[]}, requests=[];
  page.on('pageerror',e=>log.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')log.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)log.badResponses.push(`${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>log.failedRequests.push(`${r.url()}: ${r.failure()?.errorText}`));
  page.on('request',r=>{
    requests.push(r.url());
    if(/^https?:/.test(r.url()) && new URL(r.url()).origin!==new URL(process.env.ALIGNREF_BASE_URL||'http://127.0.0.1:4173').origin)log.external.push(r.url());
  });
  // Sample timer delays and JS heap without retaining image pixels or forcing GC.
  await page.addInitScript(()=>{
    window.showDirectoryPicker=()=>navigator.storage.getDirectory();
    window.perfSample={maxHeap:0,maxDelay:0,ticks:0};
    let last=performance.now();
    setInterval(()=>{const now=performance.now();const p=window.perfSample;
      p.maxDelay=Math.max(p.maxDelay,now-last-100);p.maxHeap=Math.max(p.maxHeap,performance.memory?.usedJSHeapSize||0);p.ticks++;last=now;
    },100);
  });
  await page.goto('./');
  await expect(page.locator('#load-demo')).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests.filter(u=>/\/demo\//.test(u))).toEqual([]);
  await page.screenshot({path:info.outputPath('demo-entry.png')});
  const loadStart=Date.now(); await load(page); const loadMs=Date.now()-loadStart;
  expect(requests.filter(u=>/\/demo\/.*\.jpg$/.test(u))).toHaveLength(132);
  await expect(page.locator('#count')).toHaveText('/ 132');
  await expect(page.locator('#dimensions')).toHaveText('1080 × 840 px');
  const original=await transforms(page);
  await writeFile(info.outputPath('DATA_LICENSE.md'),original.dataset.notice);
  expect(original.dataset.license).toBe('CC-BY-SA-4.0');
  await page.evaluate(()=>{window.perfSample.maxDelay=0;});
  const registrationStart=Date.now();
  await page.locator('#register').click();
  await expect(page.locator('#status')).toContainText('Rigid registration complete',{timeout:720000});
  const registrationMs=Date.now()-registrationStart;
  const performanceSample=await page.evaluate(()=>({...window.perfSample,userAgent:navigator.userAgent}));
  const registered=await transforms(page);
  expect(registered.slices).toHaveLength(132);
  const motions=registered.slices.map((s,i)=>{
    expect(validRigid(s.automaticTransform)).toBe(true);
    const center=point(s.automaticTransform,540,420);
    return {slice:i+1,name:s.name,angle:Math.atan2(s.automaticTransform[1],s.automaticTransform[0])*180/Math.PI,
      centerDisplacement:Math.hypot(center[0]-540,center[1]-420),matrix:s.automaticTransform,qc:s.qc};
  });
  const summary={browserName,channel:info.project.use.channel||"chromium",baseURL:info.project.use.baseURL,loadMs,registrationMs,performanceSample,
    imageBytes:registered.dataset.imageBytes,failures:motions.filter(s=>s.qc?.failed),warnings:motions.filter(s=>s.qc?.warning),
    maxAbsAngle:Math.max(...motions.map(s=>Math.abs(s.angle))),maxCenterDisplacement:Math.max(...motions.map(s=>s.centerDisplacement))};
  await writeFile(info.outputPath('demo-performance.json'),JSON.stringify(summary,null,2));
  await writeFile(info.outputPath('demo-registered-transforms.json'),JSON.stringify(registered,null,2));
  await page.locator('#prev').click(); await expect(page.locator('#slice')).toHaveValue('66');
  await page.locator('#overlay-prev').click(); await page.waitForTimeout(200);
  await page.locator('#overlay-next').click(); await page.waitForTimeout(200);
  await page.screenshot({path:info.outputPath('demo-overlay.png')});
  await page.locator('#record').click(); await page.keyboard.press('d'); await page.keyboard.press('e');
  await page.locator('#finish').click(); await page.locator('#range-start').click();
  await page.locator('#next').click(); await page.locator('#range-end').click(); await page.locator('#apply-range').click();
  const refined=await transforms(page);
  expect(refined.slices[65].manualTransform).toEqual(refined.slices[66].manualTransform);
  expect(refined.slices[65].manualTransform).not.toEqual([1,0,0,1,0,0]);
  expect(refined.slices[64].manualTransform).toEqual([1,0,0,1,0,0]);
  for(const [id,value] of Object.entries({'crop-x':'200','crop-y':'160','crop-width':'640','crop-height':'480'}))await page.locator('#'+id).fill(value);
  await page.locator('#crop-height').press('Tab'); await page.locator('#apply-crop').click();
  const exportStart=Date.now(); const pngs=unzipSync(await download(page,'export-zip'));
  summary.pngExportMs=Date.now()-exportStart;
  summary.pngExportHeapSample=await page.evaluate(()=>window.perfSample.maxHeap);
  expect(Object.keys(pngs).filter(n=>n.endsWith('.png'))).toHaveLength(132);
  expect(Buffer.from(pngs['DATA_LICENSE.md']).toString()).toContain('JHU-hosted distribution');
  const sizes=await page.evaluate(async inputs=>{
    const result=[];
    for(const input of inputs){const b=await createImageBitmap(new Blob([Uint8Array.from(atob(input),c=>c.charCodeAt(0))])); result.push([b.width,b.height]); b.close();}
    return result;
  },Object.entries(pngs).filter(([n])=>n.endsWith('.png')).map(([,b])=>Buffer.from(b).toString('base64')));
  expect(sizes.every(([w,h])=>w===640&&h===480)).toBe(true);
  await page.locator('#format').selectOption('jpeg');
  const jpgs=unzipSync(await download(page,'export-zip'));
  expect(Object.keys(jpgs).filter(n=>n.endsWith('.jpg'))).toHaveLength(132);
  expect([...jpgs['image0001.jpg'].slice(0,2)]).toEqual([255,216]);
  expect(jpgs['DATA_LICENSE.md']).toBeTruthy();
  await page.locator('#export-folder').click();
  await expect(page.locator('#status')).toContainText('Exported 132 JPEG images and transforms.json to AlignRef2-aligned-',{timeout:120000});
  const folder=await page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory();const dirs=[];
    for await (const [name,handle] of root.entries()) if(handle.kind==='directory')dirs.push(name);
    const dir=await root.getDirectoryHandle(dirs.sort().at(-1));const names=[];
    for await(const [name] of dir.entries())names.push(name);
    return {names,notice:await(await(await dir.getFileHandle('DATA_LICENSE.md')).getFile()).text()};
  });
  expect(folder.names.filter(n=>n.endsWith('.jpg'))).toHaveLength(132);
  expect(folder.notice).toContain('CC BY-SA 4.0');
  // A normal load uses the same pipeline and clears dataset, QC, range, crop and undo state.
  await page.locator('#files').setInputFiles({name:'user.png',mimeType:'image/png',buffer:Buffer.from(pngs['image0001.png'])});
  await expect(page.locator('#status')).toContainText('Loaded 1 images');
  const normal=await transforms(page);
  expect(normal.dataset).toBeNull(); expect(normal.slices).toHaveLength(1);
  expect(normal.slices[0].automaticTransform).toEqual([1,0,0,1,0,0]);
  expect(normal.viewport).toEqual({x:0,y:0,width:640,height:480});
  await expect(page.locator('#demo-export-notice')).toBeHidden();
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#recorded')).toHaveText('No correction recorded');
  await expect(page.locator('#registration-warnings')).toHaveText('No registration run for this stack.');
  const userExport=unzipSync(await download(page,'export-zip'));
  expect(userExport['DATA_LICENSE.md']).toBeUndefined();
  expect(log).toEqual({errors:[],badResponses:[],failedRequests:[],external:[]});
  summary.network=log;
  await writeFile(info.outputPath('demo-performance.json'),JSON.stringify(summary,null,2));
});

test('demo fetch failure and cancellation leave the loaded stack intact',async({page})=>{
  await page.goto('./');
  await load(page);
  const before=await transforms(page);
  await page.route('**/demo/mouse-brain-subj03/image0005.jpg',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.locator('#load-demo').click();
  await expect(page.locator('#status')).toContainText('image0005.jpg (HTTP 503)');
  expect((await transforms(page)).slices).toEqual(before.slices);
  await page.unrouteAll();
  await page.route('**/demo/mouse-brain-subj03/*.jpg',async route=>{
    await new Promise(r=>setTimeout(r,500));
    await route.continue().catch(()=>{});
  });
  await page.locator('#load-demo').click();
  await expect(page.locator('#status')).toContainText('Loading demo dataset');
  await page.locator('#cancel-job').click();
  await expect(page.locator('#status')).toContainText('Operation cancelled');
  expect((await transforms(page)).slices).toEqual(before.slices);
  await expect(page.locator('#record')).toBeEnabled();
});


test('one failed pair is flagged while successful pairs remain available for manual refinement',async({page})=>{
  await page.goto('./');
  const blank=await page.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=1080;c.height=840;
    const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1080,840);
    return c.toDataURL().split(',')[1];
  });
  const files=await Promise.all(['image0131.jpg','image0133.jpg','image0135.jpg'].map(async name=>({
    name,mimeType:'image/jpeg',buffer:await readFile(new URL('../public/demo/mouse-brain-subj03/'+name,import.meta.url))
  })));
  await page.locator('#files').setInputFiles([{name:'blank0000.png',mimeType:'image/png',buffer:Buffer.from(blank,'base64')},...files]);
  await expect(page.locator('#status')).toContainText('Loaded 4 images');
  await page.locator('#register').click();
  await expect(page.locator('#status')).toContainText('Rigid registration complete',{timeout:90000});
  const saved=await transforms(page);
  expect(saved.slices[0].qc.failed).toBe(true);
  expect(saved.slices[0].qc.fallback).toContain('inherited parent');
  expect(saved.slices[0].automaticTransform).toEqual(saved.slices[1].automaticTransform);
  expect(saved.slices[1].qc.failed).toBe(false);
  expect(saved.slices[3].qc.failed).toBe(false);
  await page.locator('#slice').fill('1');await page.locator('#slice').press('Tab');
  await expect(page.locator('#qc')).toContainText('pair failed');
  await page.locator('#record').click();await page.keyboard.press('d');await page.locator('#finish').click();
  await page.locator('#apply-range').click();
  expect((await transforms(page)).slices[0].manualTransform).toEqual([1,0,0,1,1,0]);
});
