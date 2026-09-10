import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { loadDemo, demoURL, validateManifest, exportDataNotice } from '../src/demo.js';
import { naturalSort } from '../src/geometry.js';
import { createState, serialize, importTransforms } from '../src/model.js';
const root = new URL('../public/demo/mouse-brain-subj03/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const notice = await readFile(new URL('DATA_LICENSE.md', root), 'utf8');
const response = (v) => new Response(v);
function fakeFetcher(image) {
  return async (url, options) => url.endsWith('manifest.json') ? response(JSON.stringify(manifest))
    : url.endsWith('DATA_LICENSE.md') ? response(notice) : image(url, options);
}
test('demo manifest, exact 132 odd filenames, natural order and on-disk byte total', async () => {
  assert.equal(validateManifest(manifest), manifest);
  const names = (await readdir(root)).filter(n => n.endsWith('.jpg'));
  assert.deepEqual(naturalSort(names.map(name => ({ name }))).map(f => f.name), manifest.files);
  assert.equal((await Promise.all(names.map(n => stat(new URL(n, root))))).reduce((n,s) => n+s.size, 0), manifest.imageBytes);
  assert.throws(() => validateManifest({ ...manifest, files: [...manifest.files.slice(1), '../outside.jpg'] }));
  assert.throws(() => validateManifest({ ...manifest, license: 'Apache-2.0' }));
});
test('demo base path resolves Pages, root and relative hosting', () => {
  assert.equal(demoURL('/AlignRef/'), '/AlignRef/demo/mouse-brain-subj03/manifest.json');
  assert.equal(demoURL('/'), '/demo/mouse-brain-subj03/manifest.json');
  assert.equal(demoURL('./', 'image0001.jpg'), './demo/mouse-brain-subj03/image0001.jpg');
});
test('demo is lazy until called, concurrency is bounded and order survives staggered fetches', async () => {
  let active=0, peak=0, calls=0;
  const progress=[];
  const fetcher = fakeFetcher(async () => {
    calls++; peak=Math.max(peak, ++active);
    await new Promise(r=>setTimeout(r, calls%3));
    active--; return response('jpeg');
  });
  assert.equal(calls, 0);
  const result = await loadDemo('/AlignRef/', { fetcher, concurrency: 8, progress:(n)=>progress.push(n) });
  assert.equal(calls, 132); assert.equal(peak, 8); assert.equal(active, 0);
  assert.deepEqual(result.files.map(f=>f.name), manifest.files);
  assert.equal(progress.at(-1),132);
  assert.match(exportDataNotice(result.dataset), /JHU-hosted distribution/);
  assert.match(exportDataNotice(result.dataset), /CC BY-SA 4.0/);
});
test('demo fetch failure aborts peers and never returns a partial stack', async () => {
  let active=0;
  const fetcher = fakeFetcher(async (url, {signal}) => {
    if (url.endsWith('image0005.jpg')) return new Response('', {status: 404});
    active++;
    try { await new Promise((resolve,reject)=> {
      const timer=setTimeout(resolve,100);
      signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
    }); return response('jpeg'); } finally { active--; }
  });
  await assert.rejects(loadDemo('/', {fetcher}), /image0005.jpg.*404/);
  assert.equal(active,0);
});
test('cancelled demo load aborts before any fetch', async () => {
  const c=new AbortController(); c.abort();
  await assert.rejects(loadDemo('/', {signal:c.signal, fetcher:()=>assert.fail('must not fetch')}), {name:'AbortError'});
});
test('demo to normal stack resets provenance; transform import cannot attach demo metadata', () => {
  const images=[{name:'a.jpg',width:1080,height:840}];
  const demo=createState(images,{...manifest,notice});
  const normal=createState(images);
  assert.equal(normal.dataset,null);
  const restored=importTransforms(serialize(demo),normal);
  assert.equal(restored.dataset,null);
  assert.equal(serialize(demo).dataset.license,'CC-BY-SA-4.0');
});
