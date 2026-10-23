# Backups: "Back up now" saves one, it is listed and downloadable, and storage counts it as Backups (not unused).
import asyncio, json
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, accept_downloads=True); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.goto(B+'#/settings?tab=data'); await pg.wait_for_timeout(1200)
        print('before', await pg.locator('.bk-body').inner_text())
        await pg.locator('.bk button:has-text("Back up now")').click(); await pg.wait_for_timeout(1500)
        print('list', await pg.locator('.bk-list li').all_inner_texts())
        assert await pg.locator('.bk-list li').count()==1
        async with pg.expect_download() as dl: await pg.locator('.bk-list button:has-text("Download")').click()
        data=json.load(open(await (await dl.value).path())); print('backup tables', len(data['data']), 'steps', len(data['data']['steps']))
        await pg.locator('.stg button:has-text("Count again")').click(); await pg.wait_for_timeout(1200)
        rows=[t.split('\n')[0] for t in await pg.locator('.stg-row').all_inner_texts()]
        print('storage rows', [t for t in await pg.locator('.stg-row').all_inner_texts() if 'Backups' in t or 'Not used' in t])
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
