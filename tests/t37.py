# Glimpse grid and stories, Swipe again / new round, final design, and samples for ideas onto the mood board.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1'); localStorage.setItem('fwp-view-elow','glimpse')}"); await pg.reload(); await pg.wait_for_timeout(400)
        await pg.goto(B+'#/w/elow/choose?view=glimpse'); await pg.wait_for_timeout(1200)
        tiles=await pg.locator('.ig-tile').count(); print('glimpse tiles', tiles, await pg.locator('.gl-filters .lchip').all_inner_texts()); assert tiles>0
        await pg.screenshot(path='shots/glimpse_grid.png')
        await pg.locator('.gl-filters .lchip:has-text("Still open")').click(); await pg.wait_for_timeout(500)
        print('open filter tiles', await pg.locator('.ig-tile').count())
        await pg.locator('.ig-tile').first.click(); await pg.wait_for_timeout(500)
        print('story', await pg.locator('.st-pos').inner_text(), '|', await pg.locator('.st-hero-tx h2').inner_text())
        await pg.screenshot(path='shots/story1.png')
        await pg.locator('.st-nav.next').click(); await pg.wait_for_timeout(300)
        print('next', await pg.locator('.st-pos').inner_text())
        # choose the leader as admin (demo user is admin & decider)
        btn=pg.locator('.st-alt .btn:has-text("Make it final")').first
        if await btn.count():
            await btn.evaluate('b=>b.click()'); await pg.wait_for_timeout(300); await pg.locator('.modal-actions .btn:has-text("Make it final")').click(); await pg.wait_for_timeout(800)
        print('after choose:', await pg.locator('.st-line').first.inner_text())
        await pg.screenshot(path='shots/story2.png')
        # add final design
        if await pg.locator('.st-acts .btn:has-text("final design")').count():
            await pg.locator('.st-acts .btn:has-text("final design")').click(); await pg.wait_for_timeout(300)
            async with pg.expect_file_chooser() as fc: await pg.locator('.modal button:has-text("Photos or a PDF")').click()
            await (await fc.value).set_files('sample.jpg'); await pg.wait_for_timeout(200)
            await pg.locator('.modal-actions .btn:has-text("final design")').click(); await pg.wait_for_timeout(1000)
            print('final badge', await pg.locator('.st-hero-tx .ig-badge').inner_text())
        # new round
        await pg.locator('.st-acts .btn:has-text("New round")').click(); await pg.wait_for_timeout(300)
        await pg.locator('.modal-actions .btn:has-text("Start a new round")').click(); await pg.wait_for_timeout(900)
        print('after new round url', pg.url.split('#')[1], '| deck count', await pg.locator('.sw-count').inner_text() if await pg.locator('.sw-count').count() else None)
        # sample for ideas -> mood board
        await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(800)
        await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(300); await pg.evaluate("()=>document.querySelectorAll('.oe-more').forEach(d=>d.open=true)")
        m=pg.locator('.modal'); await m.locator('.oe-mode button:has-text("A sample for ideas")').click()
        await m.locator('.cf input').first.fill('Bouquet'); await m.locator('input[placeholder^="e.g. Lens"]').fill('Peony idea')
        for _ in range(2):
            async with pg.expect_file_chooser() as fc: await m.locator('.oe-add').click()
            await (await fc.value).set_files('sample.jpg'); await pg.wait_for_timeout(400)
        print('save label', await m.locator('.modal-actions .btn:not(.ghost)').inner_text())
        await m.locator('.modal-actions .btn:not(.ghost)').click(); await pg.wait_for_timeout(800)
        r=await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=53'); const s=store.rows('steps').find(x=>x.title==='Bouquet'&&!x.deleted_at); const it=store.rows('board_items').find(i=>i.kind==='gallery'&&i.data&&i.data.title==='Peony idea'); return [!!s, it&&it.data.step_id===(s&&s.id), it&&it.data.images.length]}")
        print('sample on board', r); assert r==[True, True, 2]
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
