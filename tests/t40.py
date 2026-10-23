# Live mode against a stand-in Supabase: changes made with no signal wait in the outbox, show "N waiting",
# survive a reload, and are sent when the connection is back.
import asyncio
from playwright.async_api import async_playwright
L='http://localhost:8765/tests/live.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(L+'#/home'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{for(const k of ['welcome','welcome-off']) localStorage.setItem('fwp-once-'+k,'1')}")
        await pg.goto(L+'#/w/w1/todo'); await pg.reload(); await pg.wait_for_timeout(1500)
        print('pill', await pg.locator('.sync').first.get_attribute('class'))
        box=pg.locator('input[placeholder^="Add a to-do"]')
        await box.fill('Online job'); await box.press('Enter'); await pg.wait_for_timeout(600)
        print('sent online', await pg.evaluate("()=>__sent.filter(x=>x.table==='todos').length"))
        await pg.evaluate("()=>{window.__net=false}")
        await box.fill('Offline job'); await box.press('Enter'); await pg.wait_for_timeout(800)
        pill=await pg.locator('.sync').first.inner_text(); print('pill offline', pill); assert 'waiting' in pill
        print('shows offline job', await pg.locator('text=Offline job').count())
        await pg.locator('.sync').first.click(); await pg.wait_for_timeout(300)
        print('outbox list', await pg.locator('.ob-list li').all_inner_texts()); await pg.keyboard.press('Escape')
        # reload while offline: the copy on the phone opens, and the job is still there
        await pg.wait_for_timeout(1700)
        await pg.add_init_script("window.__net=false")
        await pg.reload(); await pg.wait_for_timeout(2500)
        print('after offline reload: job shown', await pg.locator('text=Offline job').count(), '| pill', await pg.locator('.sync').first.get_attribute('class'), await pg.locator('.sync').first.inner_text())
        assert await pg.locator('text=Offline job').count()==1
        in_db=await pg.evaluate("()=> (JSON.parse(localStorage.getItem('fwp-outbox-v1')||'[]')).length"); print('outbox kept', in_db)
        # back online
        await pg.evaluate("()=>{window.__net=true; window.dispatchEvent(new Event('online'))}"); await pg.wait_for_timeout(2500)
        sent=await pg.evaluate("()=>__db.todos? __db.todos.map(t=>t.title):[]"); print('in database', sent)
        print('pill after', await pg.locator('.sync').first.get_attribute('class')); assert 'Offline job' in sent
        print('errors', errs)
        await b.close()
asyncio.run(main())
