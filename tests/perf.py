import asyncio, json, sys
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2.6, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        cdp=await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}")
        await pg.goto(B+'#/w/elow/swipe'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""()=>{window.__lt=[]; new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__lt.push(Math.round(e.duration))}).observe({type:'longtask',buffered:false});}""")
        res=[]
        for i in range(4):
            t=await pg.evaluate("""()=>new Promise(r=>{const before=document.querySelector('.sw-title') && document.querySelector('.sw-card .sw-body, .sw-card'); const id0=document.querySelector('.sw-card'); const t0=performance.now(); document.querySelector('.sw-btn.love').click();
               const chk=()=>{const c=document.querySelector('.sw-card'); if(c && c!==id0 && !c.className.includes('fly')){requestAnimationFrame(()=>r(Math.round(performance.now()-t0)))} else requestAnimationFrame(chk)}; chk(); setTimeout(()=>r(-1),6000)})""")
            res.append(t); await pg.wait_for_timeout(600)
        print('vote -> next card ms (4x slower CPU):', res)
        print('long tasks:', await pg.evaluate('window.__lt'))
        sh=await pg.evaluate("()=>({doc:document.documentElement.scrollHeight, vh:innerHeight, wide: document.documentElement.scrollWidth})")
        print('swipe page height', sh)
        for h in ['#/w/elow/choose','#/w/elow/plan','#/w/charani','#/w/charani/budget','#/w/charani/lists']:
            await pg.goto(B+h); await pg.wait_for_timeout(1500)
            t=await pg.evaluate("""async()=>{const t0=performance.now(); const {render}=await import('./js/app.js?v=46'); render(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return Math.round(performance.now()-t0)}""")
            w=await pg.evaluate("()=>[document.documentElement.scrollWidth, innerWidth]")
            print(h,'redraw ms',t,'width',w)
        await b.close()
asyncio.run(main())
