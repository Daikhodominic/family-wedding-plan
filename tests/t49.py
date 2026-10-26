# At a glance: only final choices with a picture; Edit and Take off on each; taken-off ones can come back.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=57').then(m=>m.store)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}, is_mobile=True, device_scale_factor=2)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(700)
        # make two choices final: one with a photo, and the date step (no picture)
        made = await pg.evaluate(f"""async()=>{{const s=await {S}; const opts=s.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&i.wedding_id==='elow'&&(i.data.images||[]).length);
          const o=opts[0]; await s.update('board_items', o.id, {{data:{{...o.data, status:'chosen'}}}}); await s.update('steps', o.data.step_id, {{locked_at:new Date().toISOString(), status:'done'}});
          const d=s.rows('steps').find(x=>x.wedding_id==='elow'&&/date/i.test(x.title)); await s.update('steps', d.id, {{locked_at:new Date().toISOString(), gate:true, status:'done'}});
          return [s.find('steps',o.data.step_id).title, d.title]}}""")
        print('made final', made)
        await pg.goto(B+'#/w/elow/choose?view=glimpse'); await pg.wait_for_timeout(1200)
        names = await pg.locator('.ig-tile .ig-name').all_inner_texts(); print('tiles', names)
        assert len(names)==1 and made[0] in names[0] and not any('date' in n.lower() for n in names)
        print('acts', await pg.locator('.ig-act').count()); assert await pg.locator('.ig-act').count()==2
        await pg.screenshot(path='tests/shots/glance.png')
        await pg.locator('.ig-act[aria-label^="Edit"]').click(); await pg.wait_for_timeout(700)
        print('edit opens', await pg.locator('.modal h2, .modal .m-title').first.inner_text()); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.locator('.ig-act[aria-label^="Take"]').click(); await pg.wait_for_timeout(700)
        print('after take off', await pg.locator('.ig-tile').count(), await pg.locator('.gl-hidden').inner_text()); assert await pg.locator('.ig-tile').count()==0
        await pg.click('.gl-hidden'); await pg.wait_for_timeout(500); await pg.locator('.ig-act[aria-label^="Put back"]').click(); await pg.wait_for_timeout(700)
        await pg.click('.gl-hidden') if await pg.locator('.gl-hidden').count() else None; await pg.wait_for_timeout(300)
        print('back', await pg.locator('.ig-tile:not(.off)').count()); assert await pg.locator('.ig-tile:not(.off)').count()==1
        # view-only people don't get the buttons
        await pg.evaluate(f"async()=>{{const s=await {S}; s.me.isAdmin=false; s.me.role='view'; s.emit({{table:'members'}});}}"); await pg.wait_for_timeout(600)
        print('view acts', await pg.locator('.ig-act').count()); assert await pg.locator('.ig-act').count()==0
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
