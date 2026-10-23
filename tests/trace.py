# What the browser itself spends time on (style, layout, paint, raster…) for one tap, on a 4x slower CPU.
import asyncio, sys, json, collections
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
URL = sys.argv[1] if len(sys.argv)>1 else '#/w/elow/plan'
SEL = sys.argv[2] if len(sys.argv)>2 else '.step .tick'
CSS = sys.argv[3] if len(sys.argv)>3 else ''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2.6, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(600)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(800)
        if await pg.locator('.tip.auto .tip-x').count():
            await pg.locator('.tip.auto .tip-x').first.click(); await pg.wait_for_timeout(300); await pg.locator('.modal-actions .btn').last.click(); await pg.wait_for_timeout(1500)
        await pg.goto(B+URL); await pg.wait_for_timeout(1500)
        if CSS: await pg.add_style_tag(content=CSS); await pg.wait_for_timeout(500)
        cdp=await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        events=[]
        cdp.on('Tracing.dataCollected', lambda e: events.extend(e['value']))
        done=asyncio.get_event_loop().create_future()
        cdp.on('Tracing.tracingComplete', lambda e: done.set_result(1))
        await cdp.send('Tracing.start',{'categories':'devtools.timeline,disabled-by-default-devtools.timeline','transferMode':'ReportEvents'})
        await pg.evaluate(f"()=>document.querySelector({json.dumps(SEL)}).click()"); await pg.wait_for_timeout(1500)
        await cdp.send('Tracing.end'); await done
        c=collections.Counter()
        for e in events:
            if e.get('ph')=='X' and 'dur' in e: c[e['name']]+=e['dur']/1000
        print(' | '.join(f'{k} {c[k]:.0f}' for k in ['Paint','Layerize','RasterTask','PrePaint','UpdateLayoutTree','Layout','FunctionCall']))
        await b.close()
asyncio.run(main())
