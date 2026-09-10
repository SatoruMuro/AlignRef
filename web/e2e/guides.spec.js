import {test,expect} from '@playwright/test';

test('published guides: help preserves the stack, language/legacy links resolve, and narrow layouts fit',async({page,context},info)=>{
  const errors=[],http=[];
  function audit(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)http.push(`${r.status()} ${r.url()}`);});}
  audit(page);context.on('page',audit);
  await page.goto('./');
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#45829c';x.fillRect(0,0,32,32);return c.toDataURL().split(',')[1];});
  await page.locator('#files').setInputFiles({name:'guide-check.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#status')).toContainText('Loaded 1 images');
  const popup=context.waitForEvent('page');
  await page.getByRole('navigation',{name:'User guides'}).getByRole('link',{name:'使い方',exact:true}).click();
  const guide=await popup;
  await expect(guide.locator('h1')).toHaveText('AlignRef2の使い方');
  await expect(page.locator('#filename')).toHaveText('guide-check.png');
  expect(await guide.evaluate(()=>window.opener===null)).toBe(true);
  await guide.screenshot({path:info.outputPath('guide-ja-desktop.png')});
  await guide.getByRole('navigation',{name:'言語とアプリ'}).getByRole('link',{name:'English',exact:true}).click();
  await expect(guide.locator('h1')).toContainText('Quick Start Guide');
  await guide.getByRole('navigation',{name:'Language and application'}).getByRole('link',{name:'日本語',exact:true}).click();
  await expect(guide.locator('html')).toHaveAttribute('lang','ja');

  // Crawl the deployed static pages and their in-page anchors, including license files.
  const base=new URL('./',page.url()),seen=new Set();
  for(const filename of ['ja.html','en.html','legacy.html']){
    await guide.goto(new URL('guide/'+filename,base).href);
    const links=await guide.locator('a[href]').evaluateAll(nodes=>nodes.map(a=>a.href));
    for(const href of links){const u=new URL(href);if(u.origin!==base.origin)continue;
      const clean=u.origin+u.pathname;
      if(!seen.has(clean)){const r=await guide.request.get(clean);expect(r.ok(),clean).toBe(true);seen.add(clean);}
      if(u.pathname===new URL(guide.url()).pathname&&u.hash)expect(await guide.locator(`[id="${u.hash.slice(1)}"]`).count(),href).toBe(1);
    }
    for(const width of [390,320]){
      await guide.setViewportSize({width,height:844});
      expect(await guide.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${filename} at ${width}px`).toBe(true);
      await expect(guide.locator('h1')).toBeVisible();
    }
    await guide.screenshot({path:info.outputPath(filename.replace('.html','')+'-mobile.png'),fullPage:true});
  }
  await guide.getByRole('link',{name:'日本語の使い方',exact:true}).click();
  await expect(guide.locator('h1')).toHaveText('AlignRef2の使い方');
  expect(errors).toEqual([]);expect(http).toEqual([]);
});
