# How many compositing layers a page has, and why.
import asyncio, sys, collections
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
URL = sys.argv[1] if len(sys.argv)>1 else '#/w/elow/plan'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2.6, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(600)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.goto(B+URL); await pg.wait_for_timeout(2000)
        cdp=await ctx.new_cdp_session(pg); await cdp.send('DOM.enable'); await cdp.send('LayerTree.enable')
        got=asyncio.get_event_loop().create_future()
        cdp.on('LayerTree.layerTreeDidChange', lambda e: (not got.done()) and e.get('layers') and got.set_result(e['layers']))
        await pg.evaluate("()=>{document.body.style.outline='0px solid transparent'; requestAnimationFrame(()=>document.body.style.outline='')}")
        layers=await asyncio.wait_for(got, 10)
        print('layers', len(layers), 'total area Mpx', round(sum(l['width']*l['height'] for l in layers)/1e6,2))
        reasons=collections.Counter()
        for l in layers[:80]:
            try:
                r=await cdp.send('LayerTree.compositingReasons',{'layerId':l['layerId']}); reasons[','.join(r.get('compositingReasons',[]))]+=1
            except Exception as e: pass
        for k,v in reasons.most_common(15): print(v, k)
        await b.close()
asyncio.run(main())
