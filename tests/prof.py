# CPU profile of one action (default: ticking a step on Elow's full plan), top functions by self time.
import asyncio, sys, json, collections
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
SEL = sys.argv[1] if len(sys.argv)>1 else '.step .tick'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2.6, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(600)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(800)
        if await pg.locator('.tip.auto .tip-x').count():
            await pg.locator('.tip.auto .tip-x').first.click(); await pg.wait_for_timeout(300); await pg.locator('.modal-actions .btn').last.click(); await pg.wait_for_timeout(1500)
        cdp=await ctx.new_cdp_session(pg)
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4}); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval',{'interval':100})
        await cdp.send('Profiler.start')
        await pg.evaluate(f"()=>document.querySelector({json.dumps(SEL)}).click()"); await pg.wait_for_timeout(1200)
        prof=(await cdp.send('Profiler.stop'))['profile']
        nodes={n['id']:n for n in prof['nodes']}
        dt=collections.Counter()
        for s,d in zip(prof['samples'], prof['timeDeltas']): dt[s]+=d
        self_t=collections.Counter()
        for nid,t in dt.items():
            cf=nodes[nid]['callFrame']; self_t[(cf['functionName'] or '(anon)')+' '+cf['url'].split('/')[-1].split('?')[0]+':'+str(cf['lineNumber']+1)]+=t
        tot=sum(self_t.values())/1000
        print('total ms', round(tot))
        for k,v in self_t.most_common(30): print(f'{v/1000:8.1f}  {k}')
        await b.close()
asyncio.run(main())
