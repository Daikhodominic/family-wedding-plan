import asyncio, json
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
exec(open('scan.py').read().split('async def main')[0].split("JS=")[0])
JS=open('scan.py').read().split('JS="""')[1].split('"""')[0]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{localStorage.setItem('fwp-once-welcome','1');localStorage.setItem('fwp-once-guide','1')}")
        async def chk(name):
            await pg.wait_for_timeout(700); print(name, json.dumps(await pg.evaluate(JS), ensure_ascii=False)); await pg.screenshot(path=f'shots/sc_{name}.png')
        await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(1000)
        await pg.click('button:has-text("+ Add an option")'); await chk('editoption'); await pg.keyboard.press('Escape')
        await pg.goto(B+'#/w/charani/budget'); await pg.wait_for_timeout(1000)
        await pg.locator('.btn:has-text("Payment")').first.click(); await chk('payment'); await pg.keyboard.press('Escape')
        await pg.goto(B+'#/w/charani/lists'); await pg.wait_for_timeout(1000)
        await pg.locator('.lcard, .list-card').first.click(); await chk('listopen')
        await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(1200); await chk('board')
        await pg.goto(B+'#/w/charani/decide'); await pg.wait_for_timeout(1000); await chk('decide')
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(1000)
        await pg.click('.avatar'); await pg.wait_for_timeout(300); await pg.click('.menu-pop .mi:has-text("Notifications")'); await chk('notify'); await pg.keyboard.press('Escape')
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(800)
        more=pg.locator('.oh-more, button:has-text("More")').first
        if await more.count(): await more.click(); await chk('more')
        await b.close()
asyncio.run(main())
