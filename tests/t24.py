import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        pg.on('pageerror', lambda e: print('ERR', e)); pg.on('console', lambda m: print('CON', m.text) if m.type in ('error','warning') and 'TUNNEL' not in m.text else None)
        await pg.goto('http://localhost:8765/index.html?demo#/w/charani'); await pg.wait_for_timeout(500)
        await pg.click('.oh-more'); await pg.wait_for_timeout(150); await pg.click('.menu-pop .mi:has-text("Share with the partner family")'); await pg.wait_for_timeout(300)
        print('modal', await pg.locator('.modal').count(), (await pg.locator('.modal').inner_text())[:200] if await pg.locator('.modal').count() else '')
        await pg.locator('.pl-new input').fill("Adahrii's family"); await pg.click('.pl-new .btn'); await pg.wait_for_timeout(600)
        print('toasts', await pg.locator('.toast').all_inner_texts())
        print('rows', await pg.locator('.pl-row').count(), await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=46'); return JSON.stringify(store.rows('partner_links'))}"))
        await b.close()
asyncio.run(main())
