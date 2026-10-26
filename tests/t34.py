# Typed categories: a new category made from "Add an option" lands in the plan with its stage and person in charge,
# and changing them from the category page moves / updates the plan step.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
J="async(q)=>{const {store}=await import('./js/store.js?v=55'); const s=store.rows('steps').find(x=>x.title===q&&!x.deleted_at); if(!s) return null; const a=store.find('areas',s.area_id); const st=a&&store.find('stages',a.stage_id); return {id:s.id, owner:s.owner, due:s.due, gate:s.gate, area:a&&a.title, stage:st&&st.title, opts:store.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&(i.data||{}).step_id===s.id).length}}"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':360,'height':800}, is_mobile=True, has_touch=True, device_scale_factor=2)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(400)
        await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(1000)
        await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(400); await pg.evaluate("()=>document.querySelectorAll('.oe-more').forEach(d=>d.open=true)")
        m=pg.locator('.modal')
        await m.locator('.cf input').first.fill('Make-up artist'); await pg.wait_for_timeout(150)
        print('note', await m.locator('.cf-note').inner_text())
        await m.locator('.cf-row select').select_option(label='Before')
        await m.locator('.cf-row .ppl input').fill('Aunty Ela')
        await m.locator('.cf-row input[type=date]').fill('2026-11-01')
        await m.screenshot(path='shots/cf_new.png')
        await m.locator('input[placeholder^="e.g. Lens"]').fill('Glow by Neisa')
        await m.locator('.modal-actions button:has-text("Save option")').click(); await pg.wait_for_timeout(900)
        r=await pg.evaluate(J,'Make-up artist'); print('new step', r)
        assert r and r['owner']=='Aunty Ela' and r['stage']=='Before' and r['gate'] and r['opts']==1 and r['due']=='2026-11-01'
        # a second option typed into the same category reuses it
        await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(400); await pg.evaluate("()=>document.querySelectorAll('.oe-more').forEach(d=>d.open=true)")
        await m.locator('.cf input').first.fill('make-up artist'); await pg.wait_for_timeout(150)
        print('note2', await m.locator('.cf-note').inner_text(), '| who prefilled:', await m.locator('.cf-row .ppl-chip').all_inner_texts())
        await m.locator('input[placeholder^="e.g. Lens"]').fill('Studio Kohima'); await m.locator('.modal-actions button:has-text("Save option")').click(); await pg.wait_for_timeout(900)
        r=await pg.evaluate(J,'Make-up artist'); print('reused', r); assert r['opts']==2
        print('tile', await pg.locator('.ed-arch:has-text("Make-up artist")').inner_text())
        # change category: move to The wedding day / During, new owner, rename
        await pg.goto(B+f'#/w/charani/options?step={r["id"]}'); await pg.wait_for_timeout(900)
        print('meta', await pg.locator('.cat-meta').inner_text())
        await pg.click('.cat-meta .cm-edit'); await pg.wait_for_timeout(400)
        opts=await m.locator('.cf-row select option').all_inner_texts(); print('stages', opts)
        await m.locator('.cf-row select').select_option(label=opts[1]); await pg.wait_for_timeout(150)
        print('move note', await m.locator('.cf-note').inner_text())
        await m.locator('.cf-row .ppl-chip button').first.click()
        await m.locator('.cf-row .ppl input').fill('Charani'); await m.locator('.cf-row .ppl input').press('Enter')
        await m.locator('.cf-row .ppl input').fill('Vizo'); await m.locator('.cf-row .ppl input').press('Enter')
        await m.locator('.cf input').first.fill('Make-up & hair')
        await m.locator('.modal-actions button:has-text("Save")').click(); await pg.wait_for_timeout(900)
        r2=await pg.evaluate(J,'Make-up & hair'); print('after edit', r2)
        assert r2 and r2['stage']==opts[1] and r2['owner']=='Charani, Vizo' and r2['opts']==2 and r2['id']==r['id']
        print('meta after', await pg.locator('.cat-meta').inner_text())
        await pg.screenshot(path='shots/cf_page.png')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
