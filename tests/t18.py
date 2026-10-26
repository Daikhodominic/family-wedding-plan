import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(600)
        # give option B a rate and contact
        await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=57'); const it=store.find('board_items','demo-compare'); const o=it.data.options.map((x,i)=>i===1?{...x, rate:'45,000', contact:'Rose Florist 98765 43210'}:x); await store.update('board_items','demo-compare',{data:{...it.data, options:o}});}""")
        await pg.wait_for_timeout(300)
        cmp=pg.locator('.card.compare')
        await cmp.locator('.handle button[aria-label^="More"]').click(); await pg.wait_for_timeout(200)
        await pg.click('.modal .btn:has-text("Pin to a step")'); await pg.wait_for_timeout(200)
        await pg.locator('.modal select').select_option(label='Buy the gifts'); await pg.click('.modal-actions .btn:has-text("Save")'); await pg.wait_for_timeout(400)
        print('tag', await pg.locator('.card.compare .ctag.step').inner_text())
        await pg.locator('.card.compare .opt').nth(1).locator('.pill:has-text("Choose")').click(); await pg.wait_for_timeout(300)
        print('confirm', await pg.locator('.modal h2').inner_text())
        await pg.click('.modal-actions .btn:has-text("Make it final")'); await pg.wait_for_timeout(800)
        st=await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=57'); const s=store.rows('steps').find(x=>x.wedding_id==='charani'&&x.title==='Buy the gifts'); const v=store.rows('lists').find(l=>l.title==='Vendors'); const rows=v?store.rows('list_rows').filter(r=>r.list_id===v.id).map(r=>r.cells):null; const todo=store.rows('todos').find(t=>t.title.startsWith('Pay the balance')); return [!!s.locked_at, s.lock_note.with, s.lock_note.amount, rows, todo&&todo.title];}""")
        print('after choose', st)
        print('ribbon', await pg.locator('.card.compare .ribbon-chosen').count(), 'tag final', await pg.locator('.card.compare .ctag.step.final').count())
        # status + job on note
        note=pg.locator('.card.note').first
        await note.locator('.handle button[aria-label^="More"]').click(); await pg.click('.modal .filter:has-text("Shortlisted")'); await pg.wait_for_timeout(300)
        print('shortlisted', await pg.locator('.card.note.st-shortlisted').count())
        await pg.locator('.card.note').first.locator('.handle button[aria-label^="More"]').click(); await pg.click('.modal .btn:has-text("Turn into a job")'); await pg.wait_for_timeout(200)
        await pg.locator('.modal input[list="fwp-people"]').fill('Charani'); await pg.click('.modal-actions .btn:has-text("Add to the to-do list")'); await pg.wait_for_timeout(400)
        print('job tag', await pg.locator('.card.note .ctag.job').inner_text())
        # sections from plan
        await pg.click('.add-btn'); await pg.click('.add-pop .tool:has-text("Sections from the plan")'); await pg.wait_for_timeout(600)
        print('sections', await pg.locator('.card.label').count())
        # compare these from 2 cards
        hs=pg.locator('.card.contact .handle, .card.note .handle')
        await hs.nth(0).click(modifiers=['Control']); await hs.nth(1).click(modifiers=['Control']); await pg.wait_for_timeout(300)
        before = await pg.evaluate("()=>JSON.parse(localStorage.getItem('fwp-demo-v7')||'{}')")
        await pg.click('.groupbar .dt:has-text("Send to Choose")'); await pg.wait_for_timeout(400)
        await pg.locator('.modal .cf input').first.fill('Buy the gifts'); await pg.click('.modal button:has-text("Send to Choose")'); await pg.wait_for_timeout(600)
        n = await pg.evaluate("()=>{const d=JSON.parse(localStorage.getItem('fwp-demo-v7')||'{}'); return ((d.cache||{}).board_items||[]).filter(r=>r.kind==='option'&&!r.deleted_at&&!(r.data||{}).sample).length}")
        print('sent to choose', n); assert n >= 2, 'cards did not become options'
        # step drawer shows board section
        await pg.goto(B+'#/w/charani/plan'); await pg.wait_for_timeout(500); (await pg.locator('.fold-all button:has-text(\"Open all\")').click()) if await pg.locator('.fold-all').count() else None; await pg.wait_for_timeout(300)
        await pg.locator('.step .txt:has-text("Buy the gifts")').click(); await pg.wait_for_timeout(500)
        print('drawer board', (await pg.locator('.drawer .d-sec').first.inner_text())[:160].replace('\n',' | '))
        await pg.screenshot(path=D+'shots/drawer2.png')
        await pg.keyboard.press('Escape')
        print('ideas links', await pg.locator('.ideas-link').count())
        await pg.goto(B+'#/w/charani/budget'); await pg.wait_for_timeout(400)
        print('budget lockfeed', await pg.locator('.lockfeed .brow').count())
        print('errors', errs)
        await b.close()
asyncio.run(main())
