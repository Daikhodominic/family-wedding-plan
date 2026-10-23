# Bumble-style swipe: light pushes decide, slow small drags spring back, up opens the profile, Undo steps back.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':780}, is_mobile=True, has_touch=True, device_scale_factor=2); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(500)
        await pg.goto(B+'#/w/elow/swipe'); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const d=document.querySelector('.demo-flag'); if(d) d.remove()}")
        cnt=lambda: pg.evaluate("()=>parseInt(document.querySelector('.sw-count')?.textContent||'0')")
        print('maybe button gone:', await pg.locator('.sw-btn.maybe:visible').count()==0)
        async def drag(dx, dy, steps, delay):
            box=await pg.locator('.sw-card').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']*0.4
            await pg.mouse.move(cx,cy); await pg.mouse.down()
            for i in range(1,steps+1): await pg.mouse.move(cx+dx*i/steps, cy+dy*i/steps); await pg.wait_for_timeout(delay)
            await pg.mouse.up(); await pg.wait_for_timeout(650)
        n0=await cnt(); print('start', n0)
        await drag(30, 0, 10, 60); n=await cnt(); print('slow 30px', n); assert n==n0, 'small slow drag should spring back'
        await drag(85, 4, 10, 40); n=await cnt(); print('85px right', n); assert n==n0-1
        await drag(-45, 0, 3, 10); n=await cnt(); print('light flick left', n); assert n==n0-2
        await drag(0, -90, 8, 30); print('drag up -> profile open', await pg.locator('.pf-wrap').count()); assert await pg.locator('.pf-wrap').count()==1 and await cnt()==n0-2
        await pg.wait_for_timeout(300); await pg.screenshot(path='shots/profile.png')
        await pg.mouse.wheel(0, 600); await pg.wait_for_timeout(300); await pg.screenshot(path='shots/profile2.png')
        await pg.locator('.pf-bar .sw-btn.love').click(); await pg.wait_for_timeout(700)
        n=await cnt(); print('love from profile', n, 'profile closed', await pg.locator('.pf-wrap').count()==0); assert n==n0-3
        await pg.locator('.sw-btn.undo').click(); await pg.wait_for_timeout(500); n=await cnt(); print('undo', n); assert n==n0-2
        await pg.locator('.sw-btn.undo').click(); await pg.wait_for_timeout(500); n=await cnt(); print('undo again', n); assert n==n0-1
        # tap the card body opens profile; push sideways inside it decides
        await pg.locator('.sw-more').click(); await pg.wait_for_timeout(400)
        sh=await pg.locator('.pf-sheet').bounding_box(); x=sh['x']+sh['width']/2; y=sh['y']+300
        await pg.mouse.move(x,y); await pg.mouse.down()
        for i in range(1,9): await pg.mouse.move(x-i*14, y+2); await pg.wait_for_timeout(20)
        await pg.mouse.up(); await pg.wait_for_timeout(700)
        n=await cnt(); print('push left inside profile', n); assert n==n0-2
        await pg.screenshot(path='shots/swipe_after.png')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
