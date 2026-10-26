import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
WATCH = "() => { window.__swaps = 0; new MutationObserver(m => { for (const x of m) if (x.type === 'childList' && x.target.id === 'app') window.__swaps++; }).observe(document.getElementById('app'), { childList: true }); }"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(900)
        await pg.evaluate(WATCH)
        await pg.evaluate("location.hash=location.hash.split('?')[0].split('/').slice(0,3).join('/')"); await pg.wait_for_timeout(500)
        if await pg.locator('details.setup-card:not([open]) summary').count(): await pg.click('details.setup-card summary')
        await pg.click('.tip.auto .tip-x:has-text("Load it")'); await pg.wait_for_timeout(300)
        await pg.click('.modal-actions .btn:has-text("Load the checklist")'); await pg.wait_for_timeout(2000)
        print('redraws during Load it:', await pg.evaluate('window.__swaps'))
        # set a date so Fill in dates appears, then fill
        await pg.evaluate("async () => { const { store } = await import('./js/store.js?v=57'); await store.update('weddings', 'elow', { wedding_date: '2027-02-06' }); }"); await pg.wait_for_timeout(600)
        await pg.goto(B+'#/w/elow'); await pg.wait_for_timeout(900)
        if await pg.locator('details.setup-card:not([open]) summary').count(): await pg.click('details.setup-card summary')
        await pg.evaluate(WATCH)
        btn = pg.locator('.tip-x:has-text("Fill in dates")')
        print('fill button', await btn.count())
        if await btn.count():
            await btn.click(); await pg.wait_for_timeout(1500)
            n = await pg.evaluate("async () => { const { store } = await import('./js/store.js?v=57'); return store.rows('steps').filter(s => s.wedding_id==='elow' && !s.deleted_at && s.due).length; }")
            print('redraws during Fill in dates:', await pg.evaluate('window.__swaps'), '| steps with dates:', n, '| toast:', await pg.locator('.toast').all_inner_texts())
        await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(600)
        await pg.goto(B+'#/w/elow/todo'); await pg.wait_for_timeout(800)
        await pg.evaluate(WATCH)
        from_menu = pg.locator('[aria-label="Your profile"], .avatar, button.av').first
        # clear this page via the menu helper directly
        await pg.evaluate("async () => { const m = await import('./js/clear.js?v=57'); m.clearPage('elow', 'todo'); }"); await pg.wait_for_timeout(300)
        await pg.click('.modal-actions .btn:has-text("Clear this page")'); await pg.wait_for_timeout(1500)
        print('redraws during Clear this page:', await pg.evaluate('window.__swaps'))
        print('errors', errs); await b.close()
asyncio.run(main())
