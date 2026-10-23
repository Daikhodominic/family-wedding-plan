import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/elow/lists'); await pg.wait_for_timeout(500)
        await pg.click('.lchip:has-text("Gifts")'); await pg.wait_for_timeout(600)
        print('hash', await pg.evaluate('location.hash'))
        await pg.click('.lp-empty .btn'); await pg.wait_for_timeout(400)
        ins=pg.locator('.ltable.big tbody tr').first.locator('input')
        await ins.nth(0).fill('Shawl for Grandma'); await ins.nth(0).press('Tab'); await ins.nth(1).fill('Grandma'); await ins.nth(1).press('Tab')
        await ins.nth(2).fill('2500'); await ins.nth(2).press('Enter'); await pg.wait_for_timeout(500)
        await pg.locator('.ltable.big tbody tr').first.locator('.lt-tick').first.click(); await pg.wait_for_timeout(400)
        print('summary', await pg.locator('.lp-sum').inner_text())
        print('tfoot', (await pg.locator('.ltable.big tfoot').inner_text()).replace('\n',' | '))
        await pg.screenshot(path=D+'shots/listpage.png')
        # todo assigned & in progress
        await pg.goto(B+'#/w/elow/todo'); await pg.wait_for_timeout(400)
        await pg.locator('input[aria-label="New to-do"]').fill('Book the band'); await pg.locator('input[aria-label="Person in charge"]').fill('Aunty Ela'); await pg.locator('input[aria-label="New to-do"]').press('Enter'); await pg.wait_for_timeout(400)
        await pg.locator('.todo-list .tick').first.click(); await pg.wait_for_timeout(400)
        print('undo toast', await pg.locator('.toast.with-act').count(), 'done toggle', await pg.locator('.done-toggle').inner_text())
        await pg.locator('.toast.with-act button').click(); await pg.wait_for_timeout(400)
        print('after undo done-sec', await pg.locator('.done-toggle').count())
        await pg.goto(B+'#/w/elow'); await pg.wait_for_timeout(500)
        print('who', (await pg.locator('.who-grid').inner_text())[:160].replace('\n',' | '))
        print('lists block', (await pg.locator('.oblock:has(h2:text("At a glance"))').inner_text()).replace('\n',' | ')[:200])
        # date
        await pg.click('.oh-count .btn'); await pg.wait_for_timeout(200)
        await pg.locator('.modal input[type=date]').fill('2027-03-06'); await pg.click('.modal-actions .btn:has-text("Save")'); await pg.wait_for_timeout(400)
        print('date', await pg.locator('.oh-date').inner_text(), '|', await pg.locator('.shead-sub').inner_text())
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        print('home emblem', (await pg.locator('.emb.rose').inner_text()).replace('\n',' | '))
        print('errors', errs)
        await b.close()
asyncio.run(main())
