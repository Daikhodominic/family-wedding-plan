# Smart add: a pasted message with three vendors, a repeat, the review sheet, the Inbox and learning.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=55').then(m=>m.store)"
MSG = """Hi! Sharing some vendors my cousin used:

1. Lens & Light Studio – candid photography, 85k for 2 days. 98620 12345
2. Bloom Room florist @bloomroom.ne ₹45,000 for church + reception
3. Kohima Caterers - 750 per plate, call 70051 23456
4. Mystery Co, ask for Abel 94360 99999

Let me know!"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}, is_mobile=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(700)
        await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(900)
        print('bar', await pg.locator('.sa-bar').count(), await pg.locator('.sa-foot').inner_text())
        before = await pg.evaluate(f"async()=>{{const s=await {S}; return s.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&i.wedding_id==='elow').length}}")
        await pg.fill('.sa-input', MSG); await pg.click('.sa-go'); await pg.wait_for_timeout(1500)
        print('toasts', await pg.locator('.toast').all_inner_texts())
        print('review cards', [t.replace('\n',' | ')[:140] for t in await pg.locator('.sa-card').all_inner_texts()])
        await pg.screenshot(path='tests/shots/smart_review.png')
        if await pg.locator('.sa-card').count():
            await pg.locator('.modal-actions .btn:has-text("Add")').click(); await pg.wait_for_timeout(1200)
        rows = await pg.evaluate(f"""async()=>{{const s=await {S}; return s.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&i.wedding_id==='elow').slice({before}).map(i=>[i.data.title,(s.find('steps',i.data.step_id)||{{}}).title||'-',i.data.inbox?'INBOX':'',i.data.phone,i.data.rate,(i.data.links||[]).join(' ')])}}""")
        for r in rows: print('  ', r)
        assert len(rows)==4
        # a repeat (same phone) adds to the existing one, not a new option
        await pg.fill('.sa-input', 'Lens and Light — new number for the same people 98620 12345, https://lenslight.in/?utm_source=ig'); await pg.click('.sa-go'); await pg.wait_for_timeout(1200)
        if await pg.locator('.sa-card').count():
            print('repeat card', (await pg.locator('.sa-card').first.inner_text()).replace('\n',' | ')[:160])
            await pg.locator('.modal-actions .btn:has-text("Add")').click(); await pg.wait_for_timeout(800)
        n2 = await pg.evaluate(f"async()=>{{const s=await {S}; const o=s.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&i.wedding_id==='elow'); return [o.length, (o.find(i=>i.data.title==='Lens & Light Studio')||{{data:{{}}}}).data.links]}}")
        print('after repeat', n2); assert n2[0]==before+4 and 'https://lenslight.in/' in n2[1]
        # Inbox: put the unsure one somewhere, and it learns
        await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(700)
        print('inbox rows', await pg.locator('.sa-irow').all_inner_texts())
        if await pg.locator('.sa-irow').count():
            sel = pg.locator('.sa-irow select').first
            val = await sel.evaluate("s=>[...s.options].find(o=>/photo/i.test(o.textContent))?.value || s.options[1].value")
            await sel.select_option(val); await pg.wait_for_timeout(600)
            print('learned', await pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('fwp-smart-learn-elow')||'{}')).slice(0,8)"))
        # a screenshot with only a picture
        await pg.evaluate("""async()=>{const c=document.createElement('canvas');c.width=390;c.height=844;const x=c.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,390,844);x.fillStyle='#e9a';x.fillRect(20,120,350,420);
          const b=await new Promise(r=>c.toBlob(r,'image/png')); const f=new File([b],'shot.png',{type:'image/png'}); const dt=new DataTransfer(); dt.items.add(f); const inp=document.querySelector('.sa-bar input[type=file]'); inp.files=dt.files; inp.dispatchEvent(new Event('change'));}""")
        await pg.wait_for_timeout(300); print('tray', await pg.locator('.sa-thumb').count())
        await pg.fill('.sa-input', 'Dacha Events decor @dacha_events'); await pg.click('.sa-go'); await pg.wait_for_timeout(1500)
        if await pg.locator('.sa-card').count(): await pg.locator('.modal-actions .btn:has-text("Add")').click(); await pg.wait_for_timeout(1200)
        d = await pg.evaluate(f"async()=>{{const s=await {S}; const o=s.rows('board_items').find(i=>i.kind==='option'&&/^Dacha Events/.test(i.data.title||'')); return o&&[o.data.images.length,(s.find('steps',o.data.step_id)||{{}}).title,o.data.links]}}")
        print('dacha', d); assert d and d[0]==1
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
