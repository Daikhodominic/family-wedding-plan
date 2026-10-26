import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(700)
        cmp=pg.locator('.card.compare')
        print('compare has-new', await cmp.get_attribute('class'), 'cbtn', await cmp.locator('.cbtn').inner_text())
        await pg.screenshot(path=D+'shots/fb1.png')
        # reaction
        await cmp.locator('.rx.heart').click(); await pg.wait_for_timeout(300); assert await cmp.locator('.rx.heart.mine').count() == 1, 'heart did not stick'
        print('reactions', await pg.locator('.card.compare .rx').all_inner_texts())
        # vote up option B, then down -> switch
        await pg.locator('.card.compare .opt').nth(1).locator('.vote.up').click(); await pg.wait_for_timeout(200)
        await pg.locator('.card.compare .opt').nth(1).locator('.vote.down').click(); await pg.wait_for_timeout(200)
        print('B votes', (await pg.locator('.card.compare .opt').nth(1).locator('.votes').inner_text()).replace(chr(10),' '))
        print('lead', await pg.locator('.card.compare .lead-tag').count())
        # thread
        await pg.locator('.card.compare .cbtn').click(); await pg.wait_for_timeout(400)
        print('fresh in thread', await pg.locator('.cm.fresh').count(), 'total', await pg.locator('.cm').count())
        await pg.screenshot(path=D+'shots/fb2.png')
        await pg.locator('.composer .d-seg button:has-text("Suggestion")').click()
        await pg.locator('.composer textarea').fill('Test: maybe try blue ribbon?'); await pg.locator('.composer .btn').click(); await pg.wait_for_timeout(400)
        print('after send', await pg.locator('.cm').count())
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        print('after close cbtn', await pg.locator('.card.compare .cbtn').inner_text(), await pg.locator('.card.compare').get_attribute('class'))
        # non-admin view of chosen
        await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=52'); store.me.isAdmin=false; store.emit({});}"); await pg.wait_for_timeout(500)
        print('non-admin choose buttons', await pg.locator('.card.compare button.pill').count(), 'chosen tags', await pg.locator('.card.compare span.pill.on').count())
        await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=52'); store.me.isAdmin=true; store.emit({});}"); await pg.wait_for_timeout(300)
        # clear this page via menu
        await pg.click('.avatar'); await pg.click('.mi:has-text("Clear the mood board")'); await pg.wait_for_timeout(200)
        await pg.click('.modal-actions .btn:has-text("Clear this page")'); await pg.wait_for_timeout(500)
        print('cards after clear', await pg.locator('.card').count())
        await pg.goto(B+'#/bin'); await pg.wait_for_timeout(400)
        print('bin groups', await pg.locator('.bin-group').count())
        await pg.screenshot(path=D+'shots/fb3.png')
        await pg.click('.bin-group .btn:has-text("Restore all")'); await pg.wait_for_timeout(400)
        await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(400)
        print('cards after restore', await pg.locator('.card').count())
        # clear all
        await pg.click('.avatar'); await pg.click('.mi:has-text("Clear all and start over")'); await pg.wait_for_timeout(200)
        print('summary', await pg.locator('.modal .hint').last.inner_text())
        await pg.screenshot(path=D+'shots/fb4.png')
        await pg.locator('.modal input[placeholder="Type CLEAR"]').fill('clear'); await pg.click('.modal-actions .btn:has-text("Clear")'); await pg.wait_for_timeout(800)
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(400)
        print('charani stages after clear-all', await pg.locator('.stage').count())
        await pg.goto(B+'#/w/elow/budget'); await pg.wait_for_timeout(400)
        print('elow budget areas', await pg.locator('.barea').count())
        print('errors', errs)
        await b.close()
asyncio.run(main())
