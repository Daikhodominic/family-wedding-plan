import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,vp in [('d',{'width':1440,'height':900}),('m',{'width':390,'height':844})]:
            pg=await b.new_page(viewport=vp); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(B+'#/home'); await pg.wait_for_timeout(1000)
            if await pg.locator('.wl-never').count(): await pg.locator('.wl-never').first.click()
            print(name,'home nfy:', (await pg.locator('.nfy').inner_text()).replace('\n',' | ') if await pg.locator('.nfy').count() else None)
            await pg.screenshot(path=f'shots/s_{name}_home.png')
            await pg.click('.nfy'); await pg.wait_for_timeout(800)
            print(name,'deck:', await pg.locator('.sw-card h2').inner_text(), '|', await pg.locator('.sw-count').inner_text())
            await pg.screenshot(path=f'shots/s_{name}_deck.png')
            await pg.click('.sw-btn.love'); await pg.wait_for_timeout(700)
            await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(700)
            # drag the card to the right
            box = await pg.locator('.sw-card').bounding_box()
            await pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']*0.85); await pg.mouse.down(); await pg.mouse.move(box['x']+box['width']/2+200, box['y']+box['height']*0.85, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(700)
            print(name,'after 3 votes:', await pg.locator('.sw-count').all_inner_texts(), await pg.locator('.sw-done h2').all_inner_texts())
            if name=='d':
                await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(800)
                print('choose tiles:', await pg.locator('.cat-tile b').all_inner_texts())
                await pg.screenshot(path='shots/s_choose.png')
                await pg.click('.cat-tile:has-text("Photography and video")'); await pg.wait_for_timeout(800)
                print('options:', await pg.locator('.opt-card .oc-t').all_inner_texts(), await pg.locator('.oc-who').all_inner_texts())
                await pg.screenshot(path='shots/s_options.png')
                await pg.click('button:has-text("Compare the top 3")'); await pg.wait_for_timeout(500)
                print('compare cols:', await pg.locator('.cmp-col').count()); await pg.screenshot(path='shots/s_compare.png')
                await pg.locator('.modal-wrap .cmp-col').first.locator('button:has-text("See everything")').click(); await pg.wait_for_timeout(600)
                print('detail links:', await pg.locator('.link-tile').count(), '| votes', await pg.locator('.pf-who').inner_text())
                await pg.screenshot(path='shots/s_detail.png')
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
                for _ in range(3):
                    if await pg.locator('.modal-wrap').count(): await pg.locator('.modal-wrap .modal-x, .modal-wrap [aria-label="Close"]').first.click(); await pg.wait_for_timeout(200)
                # add an option
                await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(400)
                await pg.locator('.oe-form input[placeholder^="e.g. Lens"]').fill('Test Studio'); await pg.locator('.oe-form input[placeholder^="e.g. ₹"]').fill('₹70,000')
                await pg.locator('.oe-form textarea[placeholder^="One link"]').fill('https://www.instagram.com/test\nhttps://example.org')
                await pg.click('.modal-actions .btn:has-text("Save option")'); await pg.wait_for_timeout(700)
                print('after add:', await pg.locator('.opt-card .oc-t').all_inner_texts())
                await pg.locator('.opt-card:has-text("Lens") button:has-text("Choose")').click(); await pg.wait_for_timeout(300)
                await pg.click('.modal-actions .btn:has-text("Choose it")'); await pg.wait_for_timeout(900)
                print('final line:', await pg.locator('.final-line').all_inner_texts(), '| chosen:', await pg.locator('.opt-card.chosen .oc-t').all_inner_texts())
                await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(800)
                print('options on board (should be 0):', await pg.locator('.card:has-text("Lens & Light")').count())
                await pg.goto(B+'#/settings'); await pg.wait_for_timeout(800)
                print('decider buttons:', await pg.locator('.bin-row:has-text("Elow") button:has-text("Decider")').all_inner_texts())
                await pg.goto(B+'#/w/elow/budget'); await pg.wait_for_timeout(600)
            print(name,'errors', errs)
        await b.close()
asyncio.run(main())
