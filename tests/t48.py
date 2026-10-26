# View-only and Lists-only people don't see buttons they can't use.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=57').then(m=>m.store)"
async def vis(pg, sel): return await pg.evaluate(f"()=>[...document.querySelectorAll({sel!r})].filter(e=>e.getClientRects().length>0).length")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        async def role(r):
            await pg.evaluate(f"async()=>{{const s=await {S}; s.me.isAdmin={'true' if r=='full' else 'false'}; s.me.role='{r}'; s.emit({{table:'members'}});}}"); await pg.wait_for_timeout(300)
        res={}
        for r in ['full','view','lists']:
            await role(r); out={}
            await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(900); out['smart']=await vis(pg,'.sa-bar'); out['addopt']=await vis(pg,'[data-edit]')
            await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(900); out['planedit']=await vis(pg,'.plan-edit')
            await pg.goto(B+'#/w/elow/todo'); await pg.wait_for_timeout(900); out['todoadd']=await vis(pg,'[aria-label="New to-do"]')
            await pg.goto(B+'#/w/elow/lists'); await pg.wait_for_timeout(900); out['newlist']=await vis(pg,'[data-edit=lists]')
            await pg.goto(B+'#/w/elow/budget'); await pg.wait_for_timeout(900); out['payment']=await pg.locator('button:has-text("+ Payment")').count()
            await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(900); await pg.locator('.step .txt').first.click(); await pg.wait_for_timeout(600)
            out['drawer_ro']=await pg.locator('.drawer .d-ro').count(); out['drawer_save']=await vis(pg,'.drawer .d-save')
            res[r]=out; print(r, out)
            await pg.keyboard.press('Escape')
        f,v,l=res['full'],res['view'],res['lists']
        assert f['smart'] and f['planedit'] and f['todoadd'] and f['newlist'] and f['payment'] and not f['drawer_ro']
        assert not any([v['smart'], v['addopt'], v['planedit'], v['todoadd'], v['newlist'], v['payment'], v['drawer_save']]) and v['drawer_ro']
        assert not l['smart'] and not l['planedit'] and l['newlist'] and l['drawer_ro']
        await role('full')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
