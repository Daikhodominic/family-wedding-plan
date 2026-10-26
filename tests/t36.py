# Smarter adding: several photos as separate options, cover, duplicate warning, remembered vendors, delete on a card.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
J="async(q)=>{const {store}=await import('./js/store.js?v=53'); const s=store.rows('steps').find(x=>x.title===q&&!x.deleted_at); return s? store.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&(i.data||{}).step_id===s.id).map(i=>[i.data.title,(i.data.images||[]).length,i.data.phone||'']):null}"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(400)
        await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(900)
        m=pg.locator('.modal')
        async def add(cat, name, nphotos=0, phone='', split=False, change=False):
            await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(300); await pg.evaluate("()=>document.querySelectorAll('.oe-more').forEach(d=>d.open=true)")
            await m.locator('.cf input').first.fill(cat); await pg.wait_for_timeout(100)
            nm=m.locator('input[placeholder^="e.g. Lens"]'); await nm.fill(name)
            if change: await nm.dispatch_event('change'); await pg.wait_for_timeout(100)
            if phone: await m.locator('input[placeholder^="Phone"]').fill(phone)
            for _ in range(nphotos):
                async with pg.expect_file_chooser() as fc: await m.locator('.oe-add').click()
                await (await fc.value).set_files('sample.jpg'); await pg.wait_for_timeout(500)
            if split: await m.locator('.oe-split button:has-text("Separate options")').click()
            return m
        await add('Flower girl dress', 'Dress', 3, split=True)
        print('split shown', await m.locator('.oe-split:not([hidden])').count(), 'cover', await m.locator('.oe-th.cover').count())
        await m.locator('.modal-actions button:has-text("Save option")').click(); await pg.wait_for_timeout(900)
        r=await pg.evaluate(J,'Flower girl dress'); print('separate', r); assert len(r)==3 and all(x[1]==1 for x in r)
        await add('Flower girl dress', 'Dress 1')
        await m.locator('.modal-actions button:has-text("Save option")').click(); await pg.wait_for_timeout(500)
        print('duplicate warning', await pg.locator('.modal:has-text("already in this category")').count())
        await pg.locator('.modal:has-text("already in this category") button:has-text("Cancel"), .modal:has-text("already in this category") .btn.ghost').first.click(); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        r=await pg.evaluate(J,'Flower girl dress'); assert len(r)==3
        await add('Photographer', 'Lens & Light', 2, phone='98765 43210')
        await m.locator('.modal-actions button:has-text("Save option")').click(); await pg.wait_for_timeout(800)
        await add('Videographer', 'Lens & Light', change=True)
        print('remembered', await m.locator('input[placeholder^="Phone"]').input_value(), '|', await m.locator('.oe-known').inner_text())
        assert await m.locator('input[placeholder^="Phone"]').input_value()=='98765 43210'
        await m.locator('.modal-actions button:has-text("Save option")').click(); await pg.wait_for_timeout(800)
        # delete from a card
        sid=await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=53'); return store.rows('steps').find(x=>x.title==='Flower girl dress').id}")
        await pg.goto(B+f'#/w/charani/options?step={sid}'); await pg.wait_for_timeout(800)
        n0=await pg.locator('.opt-card').count()
        await pg.locator('.opt-card .oc-del').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('.modal-actions .btn:has-text("Delete")').click(); await pg.wait_for_timeout(700)
        n1=await pg.locator('.opt-card').count(); print('delete', n0, '->', n1); assert n1==n0-1
        await pg.screenshot(path='shots/t36.png')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
