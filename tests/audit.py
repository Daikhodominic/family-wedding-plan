# Full-length phone screenshots of every page, plus a count of the buttons and links each one shows.
import asyncio, json, sys
from playwright.async_api import async_playwright
from PIL import Image
B='http://localhost:8765/index.html?demo'
PAGES=[('home','#/home'),('ov','#/w/charani'),('choose','#/w/charani/choose'),('cat','#/w/charani/options?step=FIRST'),('swipe','#/w/charani/swipe'),
 ('plan','#/w/charani/plan'),('map','#/w/charani/plan?v=map'),('glimpse','#/w/charani/plan?v=glimpse'),('todo','#/w/charani/todo'),
 ('lists','#/w/charani/lists'),('budget','#/w/charani/budget'),('board','#/w/charani/board'),('famb','#/budget'),('me','#/me'),('hist','#/history'),('bin','#/bin'),('settings','#/settings'),('partner','#/p/preview-charani')]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=1); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        first=await pg.evaluate("async()=>{const m=await import('./js/swipe.js?v=53'); const {store}=await import('./js/store.js?v=53'); return m.categoriesOf(store.find('weddings','charani'))[0].step.id}")
        out={}
        for name,h in PAGES:
            h=h.replace('FIRST',first)
            if '?v=' in h: v=h.split('?v=')[1]; await pg.evaluate(f"()=>localStorage.setItem('fwp-view-charani','{v}')"); h=h.split('?')[0]
            else: await pg.evaluate("()=>localStorage.setItem('fwp-view-charani','list')")
            await pg.goto(B+h); await pg.wait_for_timeout(1300)
            await pg.evaluate("()=>{const d=document.querySelector('.demo-flag'); if(d) d.remove(); document.querySelectorAll('.snav,.shead,.pbar').forEach(e=>e.style.position='static')}")
            await pg.screenshot(path=f'shots/aud_{name}.png', full_page=True)
            info=await pg.evaluate("""()=>{const vis=e=>{const r=e.getBoundingClientRect(); return r.width>1&&r.height>1&&getComputedStyle(e).visibility!=='hidden'};
              const btns=[...document.querySelectorAll('#app button, #app a')].filter(vis).map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,30)).filter(Boolean);
              return {h:document.documentElement.scrollHeight, n:btns.length, tips:document.querySelectorAll('#app .tip').length, btns}}""")
            out[name]=info
        json.dump(out,open('shots/aud.json','w'),indent=1)
        for k,v in out.items(): print(f"{k:9s} height {v['h']:5d}  controls {v['n']:3d}  tips {v['tips']}")
        await b.close()
asyncio.run(main())
