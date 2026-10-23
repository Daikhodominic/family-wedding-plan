# Sharing into the War Room (as from WhatsApp): the service worker keeps the files, the share page files them
# into an existing vendor or a new option. Also: the short Add-an-option form keeps name and price up front.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(1500)
        # the site only registers its service worker on the live https site; register it here to test sharing
        await pg.evaluate("async()=>{await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;}")
        await pg.reload(); await pg.wait_for_timeout(1500)
        img = open('sample.jpg','rb').read()
        res = await pg.evaluate("""async(bytes)=>{const fd=new FormData(); fd.append('text','Lens & Light https://www.instagram.com/p/ABC123/'); for(let i=0;i<3;i++) fd.append('media', new File([new Uint8Array(bytes)], 'w'+i+'.jpg', {type:'image/jpeg'}));
            const r=await fetch('./share-target',{method:'POST', body:fd, redirect:'manual'}); return [r.type, r.status, !!navigator.serviceWorker.controller]}""", list(img))
        print('post', res)
        await pg.goto(B+'#/share'); await pg.wait_for_timeout(1500)
        print('share page', await pg.locator('.sh-sum').inner_text())
        await pg.locator('.sh-step .lchip').first.click(); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/share.png', full_page=True)
        n=await pg.locator('.sh-opt').count(); print('vendors offered', n); assert n>0
        t=(await pg.locator('.sh-opt .sh-on').first.inner_text()).split('\n')[0]
        before=await pg.evaluate("async(t)=>{const {store}=await import('./js/store.js?v=47'); const o=store.rows('board_items').find(i=>i.kind==='option'&&!i.deleted_at&&i.data.title===t); return [o.id,(o.data.images||[]).length]}", t)
        await pg.locator('.sh-opt').first.click(); await pg.wait_for_timeout(300); print('toasts', await pg.locator('.toast').all_inner_texts()); await pg.wait_for_timeout(1500); print('toasts', await pg.locator('.toast').all_inner_texts())
        after=await pg.evaluate("async(id)=>{const {store}=await import('./js/store.js?v=47'); const o=store.find('board_items',id); return [(o.data.images||[]).length, o.data.links]}", before[0])
        print('added to vendor', before[1], '->', after); assert after[0]==before[1]+3 and any('instagram' in x for x in after[1])
        print('url now', pg.url.split('#')[1])
        # short form
        await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(800)
        await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(300)
        vis=await pg.evaluate("()=>[...document.querySelectorAll('.modal .field > label')].filter(l=>!l.closest('details:not([open])')).map(l=>l.textContent.trim())")
        print('visible fields', vis); assert 'Name' in vis and 'Price or quote' in vis and 'Phone' not in vis
        await pg.screenshot(path='shots/shortform.png')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
