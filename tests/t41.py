# Version history: change and delete rows in a list, then undo one change, bring back a deleted row,
# and put the whole list back to an earlier moment. Same for an option's price.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1100,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        lid=await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=55'); const l=await store.insert('lists',{wedding_id:'charani', title:'History test', columns:['Name','Count']});
           for (const [i,n] of ['Ana','Ben','Cal'].entries()) await store.insert('list_rows',{list_id:l.id, wedding_id:'charani', cells:[n,'1'], position:i}); return l.id}""")
        await pg.goto(B+f'#/w/charani/lists?list={lid}'); await pg.wait_for_timeout(700)
        ins=pg.locator('.ltable tbody tr').nth(0).locator('input').first
        await ins.fill('Anna'); await ins.press('Tab'); await pg.wait_for_timeout(300)
        await pg.locator('.ltable tbody tr').nth(1).locator('.act .icon-btn').click(); await pg.wait_for_timeout(400)
        names=lambda: pg.evaluate(f"async()=>{{const {{store}}=await import('./js/store.js?v=55'); return store.rows('list_rows').filter(r=>r.list_id==='{lid}').sort((a,b)=>a.position-b.position).map(r=>r.cells[0])}}")
        print('now', await names())
        await pg.click('button:has-text("History")'); await pg.wait_for_timeout(500)
        items=await pg.locator('.vh-item .vh-tx span').all_inner_texts(); print('history', items)
        await pg.locator('.vh-item:has-text("deleted a row") button:has-text("Bring back")').click(); await pg.wait_for_timeout(500)
        n=await names(); print('after bring back', n); assert 'Ben' in n
        await pg.click('button:has-text("History")'); await pg.wait_for_timeout(500)
        await pg.locator('.vh-item:has-text("Ana") button:has-text("Undo this")').first.click(); await pg.wait_for_timeout(500)
        n=await names(); print('after undo rename', n); assert 'Ana' in n and 'Anna' not in n
        # whole list back to just after the three rows were added
        await ins.fill('Zed'); await ins.press('Tab'); await pg.wait_for_timeout(300)
        await pg.click('button:has-text("History")'); await pg.wait_for_timeout(500)
        adds=pg.locator('.vh-item:has-text("added a row")'); last=adds.nth(await adds.count()-3)  # just after the third row was first added
        await last.locator('button:has-text("Back to here")').click(); await pg.wait_for_timeout(300)
        await pg.locator('.modal-actions .btn:has-text("Put it back")').click(); await pg.wait_for_timeout(700)
        n=await names(); print('after back to here', n); assert n==['Ana','Ben','Cal']
        # option price
        oid=await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=55'); const o=store.rows('board_items').find(i=>i.kind==='option'&&i.wedding_id==='charani'); await store.update('board_items',o.id,{data:{...o.data, rate:'₹99,999'}}); return o.id}")
        await pg.evaluate(f"async()=>{{const m=await import('./js/versions.js?v=55'); const {{store}}=await import('./js/store.js?v=55'); m.openHistory('option', store.find('board_items','{oid}'))}}"); await pg.wait_for_timeout(500)
        print('option history', await pg.locator('.vh-item .vh-tx span').first.inner_text())
        await pg.locator('.vh-item button:has-text("Undo this")').first.click(); await pg.wait_for_timeout(400)
        rate=await pg.evaluate(f"async()=>{{const {{store}}=await import('./js/store.js?v=55'); return store.find('board_items','{oid}').data.rate}}"); print('rate back to', rate); assert rate!='₹99,999'
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
