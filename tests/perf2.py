# Tap-to-screen times for everyday actions on a slow phone (CPU 4x slower), with the Chrome profiler's long tasks.
import asyncio, sys
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
TAP = """(sel)=>new Promise(r=>{const el=document.querySelector(sel); if(!el) return r('missing'); const t0=performance.now(); el.click();
  let n=0; const tick=()=>{ if(++n<3) return requestAnimationFrame(tick); r(Math.round(performance.now()-t0)); }; requestAnimationFrame(tick); })"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2.6, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(600)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(800)
        # the full checklist makes the plan realistically big
        if await pg.locator('.tip.auto .tip-x').count():
            await pg.locator('.tip.auto .tip-x').first.click(); await pg.wait_for_timeout(300)
            await pg.locator('.modal-actions .btn').last.click(); await pg.wait_for_timeout(1500)
        cdp=await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        await pg.evaluate("""()=>{window.__lt=[]; new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__lt.push(Math.round(e.duration))}).observe({type:'longtask'});}""")
        out=[]
        async def m(label, url, sel, settle=900):
            if url: await pg.goto(B+url); await pg.wait_for_timeout(1500)
            await pg.evaluate("()=>{window.__lt=[]}")
            t=await pg.evaluate(TAP, sel); await pg.wait_for_timeout(settle)
            lt=await pg.evaluate("()=>window.__lt"); out.append((label,t,lt)); print(f'{label:38s} {t!s:>6} ms   long tasks {lt}')
        nav = lambda u: m('open '+u, None, f'a[href="{u}"]')
        await m('open plan (from overview)', '#/w/elow', '.snav a[href$="/plan"]')
        await m('open all areas', None, '.fold-all button')
        await m('tick a step', None, '.step .tick, .step .chk, .step button.circle')
        await m('open a step drawer', None, '.step .txt')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        await m('switch to Map', None, '.viewtoggle button:nth-child(2)')
        await m('open Choose', None, '.snav a[href$="/choose"]')
        await m('open a category', None, '.cat-tile')
        await m('open Budget', None, '.snav a[href$="/budget"]')
        await m('open Lists', None, '.snav a[href$="/lists"]')
        await m('open Overview', None, '.snav a[href$="/w/elow"], .snav a:first-child')
        await b.close()
asyncio.run(main())
