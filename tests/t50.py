# Coming back: a pop-up shows what's new to swipe (once per visit, only new things); swipe everything again to change votes.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=57').then(m=>m.store)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=2); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.evaluate("()=>{localStorage.clear(); sessionStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1'); localStorage.setItem('fwp-test-newpop','1')}"); await pg.reload(); await pg.wait_for_timeout(2600)
        t = await pg.locator('.np-modal').count(); print('popup', t, await pg.locator('.np-modal h2, .np-modal .m-title').first.inner_text() if t else '')
        assert t == 1
        print('rows', await pg.locator('.np-row').all_inner_texts())
        await pg.screenshot(path='tests/shots/newpop.png')
        await pg.locator('.modal-actions .btn:has-text("Start swiping")').click(); await pg.wait_for_timeout(900)
        print('went to', pg.url.split('#')[1]); assert '/swipe' in pg.url
        # same visit: no second pop-up
        await pg.goto(B+'#/w/elow'); await pg.wait_for_timeout(2400); assert await pg.locator('.np-modal').count()==0
        # new visit with nothing new: no pop-up
        await pg.evaluate("()=>sessionStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(2600); print('nothing new ->', await pg.locator('.np-modal').count()); assert await pg.locator('.np-modal').count()==0
        # someone adds an option -> next visit shows just that one
        await pg.evaluate(f"""async()=>{{const s=await {S}; const st=s.rows('steps').find(x=>x.wedding_id==='elow'&&/photo/i.test(x.title)); await s.insert('board_items',{{wedding_id:'elow',kind:'option',x:0,y:0,w:280,z:1,data:{{step_id:st.id,title:'Brand new studio',images:[],links:[],status:'open'}}}}); sessionStorage.clear();}}""")
        await pg.reload(); await pg.wait_for_timeout(2600)
        print('after new', await pg.locator('.np-modal h2, .np-modal .m-title').first.inner_text()); assert '1 new' in await pg.locator('.np-modal').inner_text()
        await pg.locator('.modal-actions .btn:has-text("Later")').click(); await pg.wait_for_timeout(300)
        # vote on one, then swipe everything again: it comes back, showing your vote
        await pg.goto(B+'#/w/elow/swipe'); await pg.wait_for_timeout(900)
        first = await pg.locator('.sw-card h2').inner_text(); await pg.locator('.sw-actions .sw-btn.love').click(); await pg.wait_for_timeout(700)
        await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(800); print('choose swipe btn', await pg.locator('.ch-swipe').inner_text())
        await pg.goto(B+'#/w/elow/swipe?all=1'); await pg.wait_for_timeout(900)
        titles=[]; mine=[]
        for _ in range(40):
            if not await pg.locator('.sw-card').count(): break
            titles.append(await pg.locator('.sw-card h2').inner_text()); mine.append(await pg.locator('.sw-card .sw-mine').count())
            await pg.locator('.sw-actions .sw-btn.love').click(); await pg.wait_for_timeout(350)
        print('again saw', len(titles), 'had my vote shown on', sum(mine)); assert first in titles and sum(mine)>=1
        print('done screen', await pg.locator('.sw-done h2').inner_text())
        v = await pg.evaluate(f"async()=>{{const s=await {S}; const o=s.rows('board_items').find(i=>i.data&&i.data.title==={first!r}); return s.rows('reactions').filter(r=>r.item_id===o.id&&r.created_by===s.me.id).map(r=>r.value)}}")
        print('vote kept on the one loved twice', v); assert v==['love']
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
