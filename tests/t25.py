import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow/plan'); await pg.wait_for_timeout(1000)
        print('offer', await pg.locator('.tip.auto:has-text("full checklist")').count())
        await pg.click('.tip.auto .tip-x:has-text("Load it")'); await pg.wait_for_timeout(300)
        await pg.click('.modal-actions .btn:has-text("Load the checklist")'); await pg.wait_for_timeout(1200)
        n = await pg.evaluate("""async () => { const { store } = await import('./js/store.js?v=42'); const live = r => r.filter(x => !x.deleted_at);
          const st = live(store.rows('stages')).filter(s => s.wedding_id==='elow'); const ar = live(store.rows('areas')).filter(s => s.wedding_id==='elow'); const sp = live(store.rows('steps')).filter(s => s.wedding_id==='elow');
          const binned = store.rows('steps').filter(s => s.wedding_id==='elow' && s.deleted_at).length;
          return [st.map(s=>s.title), ar.length, sp.length, sp.filter(s=>s.gate).length, binned]; }""")
        print('stages/areas/steps/gates/binned', n)
        print('offer after', await pg.locator('.tip.auto:has-text("full checklist")').count(), 'toast', await pg.locator('.toast').all_inner_texts())
        await pg.screenshot(path='shots/elow_plan_loaded.png')
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow'); await pg.wait_for_timeout(900)
        await pg.screenshot(path='shots/elow_overview_loaded.png')
        pg2=await b.new_page(viewport={'width':390,'height':844})
        await pg2.goto('http://localhost:8765/index.html?demo#/w/elow/plan'); await pg2.wait_for_timeout(900)
        await pg2.screenshot(path='shots/elow_plan_m.png')
        await pg.goto('http://localhost:8765/index.html?demo#/w/charani/plan'); await pg.wait_for_timeout(700)
        print('charani offer (should be 0)', await pg.locator('.tip.auto:has-text("full checklist")').count())
        print('errors', errs); await b.close()
asyncio.run(main())
