# First-visit tour (shows until "Don't show again"), admin storage panel, and downloads (.zip of photos, backup with photos).
import asyncio, zipfile, io
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, accept_downloads=True); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{localStorage.clear(); sessionStorage.clear()}"); await pg.reload(); await pg.wait_for_timeout(1500)
        print('tour shown', await pg.locator('.tour').count()); assert await pg.locator('.tour').count()==1
        for _ in range(3): await pg.locator('.tour .btn:has-text("Next")').click(); await pg.wait_for_timeout(120)
        print('slide', await pg.locator('.tour .eyebrow').inner_text(), '|', await pg.locator('.tour h2').inner_text())
        await pg.screenshot(path='shots/tour.png')
        await pg.locator('.wl-never').click(); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>sessionStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(1500)
        print('after never, tour', await pg.locator('.tour').count()); assert await pg.locator('.tour').count()==0
        await pg.click('.avatar'); await pg.wait_for_timeout(200); await pg.locator('.menu-pop .mi:has-text("How to use")').click(); await pg.wait_for_timeout(300)
        assert await pg.locator('.tour').count()==1; await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # add an option with 2 photos, then download the category's photos as a zip
        await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(800)
        await pg.click('button:has-text("+ Add an option")'); await pg.wait_for_timeout(300)
        m=pg.locator('.modal'); await m.locator('.cf input').first.fill('Make-up artist'); await m.locator('input[placeholder^="e.g. Lens"]').fill('Glow')
        for _ in range(2):
            async with pg.expect_file_chooser() as fc: await m.locator('.oe-add').click()
            await (await fc.value).set_files('sample.jpg'); await pg.wait_for_timeout(400)
        await m.locator('.modal-actions .btn:not(.ghost)').click(); await pg.wait_for_timeout(800)
        sid=await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=45'); return store.rows('steps').find(x=>x.title==='Make-up artist').id}")
        await pg.goto(B+f'#/w/charani/options?step={sid}'); await pg.wait_for_timeout(800)
        async with pg.expect_download() as dl: await pg.locator('button:has-text("⬇ Photos")').click()
        d=await dl.value; z=zipfile.ZipFile(await d.path()); print('category zip', d.suggested_filename, z.namelist()); assert len(z.namelist())==2 and z.testzip() is None
        # lightbox download
        await pg.locator('.opt-card .oc-pic').first.click(); await pg.wait_for_timeout(500)
        await pg.locator('.pf-hero').click(); await pg.wait_for_timeout(400)
        async with pg.expect_download() as dl: await pg.locator('.lb-dl').click()
        print('single photo', (await dl.value).suggested_filename)
        await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # storage panel
        await pg.goto(B+'#/settings'); await pg.wait_for_timeout(1800)
        print('storage', (await pg.locator('.stg-top').inner_text()), '|', [t.replace('\n',' / ') for t in await pg.locator('.stg-row').all_inner_texts()][:3])
        await pg.locator('.stg').screenshot(path='shots/storage.png')
        # backup with photos
        await pg.click('button:has-text("Download a backup")'); await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl: await pg.locator('.modal-actions .btn:has-text("With all photos")').click()
        z=zipfile.ZipFile(await (await dl.value).path()); names=z.namelist(); print('backup zip', len(names), names[:3]); assert 'backup.json' in names and len(names)>=3
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
