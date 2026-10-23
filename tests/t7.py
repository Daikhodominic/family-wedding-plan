import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':810})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/elow/board'); await pg.wait_for_timeout(600)
        count=lambda: pg.evaluate("document.querySelectorAll('.card').length")
        print('start', await count())
        for name in ['Note','Link','Contact','Section','Colours']:
            await pg.click('.add-btn'); await pg.click(f'.add-pop .tool:has-text("{name}")'); await pg.wait_for_timeout(300)
            m=await pg.locator('.modal').count()
            inp=pg.locator('.modal input, .modal textarea').first
            if await inp.count(): await inp.fill('Test '+name if name!='Link' else 'https://example.com')
            btn=pg.locator('.modal-actions .btn').last
            if await btn.count(): await btn.click()
            await pg.wait_for_timeout(300)
            print(name,'modal',m,'cards',await count(), 'modals left', await pg.locator('.modal').count())
        for name,f in [('Photos or video','sample.jpg'),('Document','sample.pdf')]:
            async with pg.expect_file_chooser() as fc:
                await pg.click('.add-btn'); await pg.click(f'.add-pop .tool:has-text("{name}")')
            ch=await fc.value; await ch.set_files(D+f); await pg.wait_for_timeout(1500)
            print(name,'cards',await count())
        await pg.screenshot(path=D+'shots/board_test.png')
        print('errors',errs)
        await b.close()
asyncio.run(main())
