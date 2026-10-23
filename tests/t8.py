import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/elow/budget'); await pg.wait_for_timeout(600)
        _stat=lambda n: pg.locator('.stat').nth(n).locator('b').inner_text()
        async def stat(n):
            if n==3: return await pg.locator('.stat').nth(0).locator('small').inner_text()
            if n==4: return await pg.locator('span:has(> i.rb-seg.free) b').first.inner_text()
            return await _stat(n)
        print('cost',await stat(1),'topay',await stat(2),'cont',await stat(3),'free',await stat(4))
        await pg.locator('.bmain .brow:has-text("Caterer advance") .btn:has-text("Mark paid")').click(); await pg.wait_for_timeout(300)
        print('after paid: topay',await stat(2))
        # add unplanned payment of 1.5 lakh
        await pg.click('.ph-right .btn:has-text("+ Payment")'); await pg.wait_for_timeout(200)
        ins=pg.locator('.modal input')
        await ins.nth(0).fill('Test band'); await ins.nth(1).fill('1.5 lakh')
        await pg.locator('.modal select').select_option(label='Unplanned — from contingency')
        await pg.click('.modal-actions .btn:has-text("Add payment")'); await pg.wait_for_timeout(300)
        print('after unplanned: cont',await stat(3), 'warn', await pg.locator('.bwarn').count())
        # remove Venue area
        await pg.locator('.barea:has-text("Example: Venue") .menu-btn').first.click(); await pg.wait_for_timeout(200)
        await pg.click('.modal .btn:has-text("Remove this area")'); await pg.wait_for_timeout(200)
        await pg.click('.modal-actions .btn:has-text("Remove area")'); await pg.wait_for_timeout(400)
        print('after remove venue: free',await stat(4),'removed section',await pg.locator('h2:has-text("From removed areas")').count())
        # move 4 lakh free -> catering
        await pg.click('.ph-right .btn:has-text("More")'); await pg.wait_for_timeout(150); await pg.click('.menu-pop .mi:has-text("Move money")'); await pg.wait_for_timeout(200)
        sels=pg.locator('.modal select'); await sels.nth(0).select_option('free'); await sels.nth(1).select_option(label=await sels.nth(1).locator('option').nth(2).inner_text())
        await pg.locator('.modal input').fill('6 lakh'); await pg.click('.modal-actions .btn:has-text("Move")'); await pg.wait_for_timeout(300)
        if await pg.locator('.modal:has-text("Move more than")').count(): await pg.click('.modal-actions .btn:has-text("Move anyway")'); await pg.wait_for_timeout(300)
        print('after move: free',await stat(4))
        await pg.screenshot(path=D+'shots/budget_after.png', full_page=True)
        # restore venue from bin -> should warn
        await pg.goto(B+'#/bin'); await pg.wait_for_timeout(400)
        await pg.locator('.bin-row:has-text("Venue") .btn:has-text("Restore")').click(); await pg.wait_for_timeout(300)
        print('restore warning modal', await pg.locator('.modal:has-text("Not enough free money")').count())
        await pg.click('.modal-actions .btn:has-text("Restore anyway")'); await pg.wait_for_timeout(400)
        await pg.goto(B+'#/w/elow/budget'); await pg.wait_for_timeout(400)
        print('after restore: free',await stat(4),'warn',await pg.locator('.bwarn').inner_text() if await pg.locator('.bwarn').count() else None)
        await pg.goto(B+'#/history'); await pg.wait_for_timeout(400)
        print('history:', (await pg.locator('.feed').first.inner_text())[:500])
        print('errors',errs)
        await b.close()
asyncio.run(main())
