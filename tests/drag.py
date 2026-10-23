import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, is_mobile=True, has_touch=True); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(600)
        await pg.evaluate("()=>{for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}")
        await pg.goto(B+'#/w/elow/swipe'); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const d=document.querySelector('.demo-flag'); if(d) d.remove()}")
        cnt=lambda: pg.evaluate("()=>document.querySelector('.sw-count')?.textContent")
        box=await pg.locator('.sw-card').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']*0.35
        print('start', await cnt())
        # mid-drag screenshot
        await pg.mouse.move(cx,cy); await pg.mouse.down()
        for i in range(1,9): await pg.mouse.move(cx+i*10, cy+i*2); await pg.wait_for_timeout(45)
        await pg.screenshot(path='shots/drag_mid.png')
        # small release -> spring back
        await pg.mouse.up(); await pg.wait_for_timeout(600); print('after short drag', await cnt())
        # long drag -> love
        await pg.mouse.move(cx,cy); await pg.mouse.down()
        for i in range(1,15): await pg.mouse.move(cx+i*15, cy); await pg.wait_for_timeout(16)
        await pg.mouse.up(); await pg.wait_for_timeout(700); print('after long right drag', await cnt())
        # quick flick left, short distance
        await pg.mouse.move(cx,cy); await pg.mouse.down()
        for i in range(1,5): await pg.mouse.move(cx-i*20, cy); await pg.wait_for_timeout(8)
        await pg.mouse.up(); await pg.wait_for_timeout(700); print('after flick left', await cnt())
        # drag up -> maybe
        await pg.mouse.move(cx,cy); await pg.mouse.down()
        for i in range(1,12): await pg.mouse.move(cx+2, cy-i*14); await pg.wait_for_timeout(16)
        await pg.mouse.up(); await pg.wait_for_timeout(700); print('after drag up', await cnt())
        # tap right side of photo -> next photo
        before=await pg.evaluate("()=>document.querySelector('.sw-count-pic')?.textContent")
        await pg.mouse.click(box['x']+box['width']*0.85, cy); await pg.wait_for_timeout(300)
        after=await pg.evaluate("()=>document.querySelector('.sw-count-pic')?.textContent")
        print('photo tap', before, '->', after, '| modal open?', await pg.locator('.modal').count())
        await pg.screenshot(path='shots/drag_end.png'); print(errs); await b.close()
asyncio.run(main())
