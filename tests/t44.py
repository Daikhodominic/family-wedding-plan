# Duplicate a step and a list, start a wedding from another's plan, and build the memory book.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=50').then(m=>m.store)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(700)
        r = await pg.evaluate(f"""async()=>{{const s=await {S}; const d=await import('./js/duplicate.js?v=50');
          const st=s.rows('steps').find(x=>x.wedding_id==='charani'&&!x.deleted_at); const c=await d.duplicateStep(st);
          const l=await s.insert('lists',{{wedding_id:'charani',title:'Guests',columns:['Name','Phone']}}); await s.insertMany('list_rows',[{{list_id:l.id,wedding_id:'charani',cells:['A','1'],position:1}},{{list_id:l.id,wedding_id:'charani',cells:['B','2'],position:2}}]);
          const lc=await d.duplicateList(l);
          return [c.title, c.area_id===st.area_id, lc.title, s.rows('list_rows').filter(r=>r.list_id===lc.id).length];}}""")
        print('duplicate', r); assert r[1] and r[3]==2
        # new space from Charani's plan
        await pg.goto(B+'#/settings'); await pg.wait_for_timeout(700)
        print('start options', await pg.locator('#new-tpl option').all_inner_texts())
        panel = pg.locator('section.panel:has-text("Add a wedding or event")')
        await panel.locator('input').first.fill('Test & Copy')
        await pg.select_option('#new-tpl', index=1)
        await panel.locator('button:has-text("Add this space")').click(); await pg.wait_for_timeout(1200)
        n = await pg.evaluate(f"""async()=>{{const s=await {S}; const w=s.rows('weddings').find(w=>w.couple==='Test & Copy'); const live=t=>s.rows(t).filter(r=>!r.deleted_at&&r.wedding_id===w.id);
          const src=s.rows('steps').filter(r=>!r.deleted_at&&r.wedding_id==='charani').length;
          return {{steps: live('steps').length, src, ticked: live('steps').filter(x=>x.status==='done'||x.locked_at).length, owners: live('steps').filter(x=>x.owner).length, lists: live('lists').length, lines: s.rows('budget_areas').filter(a=>a.budget_id===w.id).length}}}}""")
        print('copied', n); assert n['steps']>0 and n['ticked']==0 and n['owners']==0
        # memory book
        async with ctx.expect_page() as pp:
            await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(700)
            await pg.evaluate("async()=>{const m=await import('./js/memorybook.js?v=50'); const {store}=await import('./js/store.js?v=50'); window.__mb=await m.memoryBook(store.find('weddings','charani'))}")
        book = await pp.value; await book.wait_for_load_state(); await book.wait_for_timeout(400)
        print('book sections', await book.locator('section.page').count(), '| chose tiles', await book.locator('.tile').count(), '| nums', (await book.locator('.nums').inner_text()).replace('\n',' ')[:160])
        await book.screenshot(path='shots/memory_book.png', full_page=True)
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
