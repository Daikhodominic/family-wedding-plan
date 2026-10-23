import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/settings?tab=family'); await pg.wait_for_timeout(500)
        print('decider buttons', await pg.locator('button:has-text("Decider · ")').count())
        await pg.locator('.bin-row:has-text("Example relative") button:has-text("Decider · ")').first.click(); await pg.wait_for_timeout(300)
        print('tags', await pg.locator('.role-tag').count())
        await pg.goto(B+'#/w/elow/budget'); await pg.wait_for_timeout(400)
        print('decider: payment btn', await pg.locator('.ph-right .btn:has-text("+ Payment")').count())
        await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=48'); store.me.isAdmin=false; store.me.isDecider=false; store.emit({});}"); await pg.wait_for_timeout(500)
        print('family: payment btn', await pg.locator('.ph-right .btn:has-text("+ Payment")').count(), 'note', await pg.locator('.ro-note').count(), 'markpaid', await pg.locator('.btn:has-text("Mark paid")').count())
        await pg.locator('.brow-main').first.click(); await pg.wait_for_timeout(300)
        print('modal opened?', await pg.locator('.modal').count(), 'toast', await pg.locator('.toast').last.inner_text())
        await pg.goto(B+'#/w/elow/board'); await pg.wait_for_timeout(400)
        print('family choose btns', await pg.locator('.card.compare button.pill').count())
        print('errors', errs)
        await b.close()
asyncio.run(main())
