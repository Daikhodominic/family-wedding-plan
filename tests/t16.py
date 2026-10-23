import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':810})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/elow/todo'); await pg.wait_for_timeout(400)
        print('datalist options', await pg.evaluate("document.querySelectorAll('#fwp-people option').length"))
        await pg.locator('input[aria-label="New to-do"]').fill('Book the band'); await pg.locator('input[aria-label="Person in charge"]').fill('you'); await pg.locator('input[aria-label="Due date"]').fill('2026-10-20'); await pg.locator('input[aria-label="New to-do"]').press('Enter'); await pg.wait_for_timeout(400)
        await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=49'); const s=store.rows('steps').find(x=>x.wedding_id==='charani'&&x.title==='Food tasting'); await store.update('steps', s.id, {owner:'Charani', due:'2026-10-10', status:'doing'});}")
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
        print('greet', await pg.locator('.greet-card').inner_text())
        await pg.screenshot(path=D+'shots/home_greet.png')
        await pg.goto(B+'#/me'); await pg.wait_for_timeout(400)
        print('myjobs', (await pg.locator('main').inner_text())[:300].replace('\n',' | '))
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(400)
        print('who', (await pg.locator('.who-grid').inner_text())[:120].replace('\n',' | '))
        print('errors', errs)
        await b.close()
asyncio.run(main())
