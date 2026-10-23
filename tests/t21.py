import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1440,'height':900}); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(600)
        await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=49'); const it=store.find('board_items','demo-compare');
          const o=it.data.options.map((x,i)=>({...x, rate: i===0?'₹40 per piece':'₹55 per piece'}));
          await store.update('board_items','demo-compare',{data:{...it.data, options:o}, created_at: new Date(Date.now()-5*86400000).toISOString()});
          for (const [u,v] of [['demo-charani','up'],['demo-elow','up']]) store.cache.reactions.push({id:'r'+u, wedding_id:'charani', item_id:'demo-compare', target:'o-a', value:v, created_by:u, user_name:u, created_at:new Date().toISOString()});
          store.emit({table:'reactions'});}""")
        await pg.wait_for_timeout(500)
        print('insight', await pg.locator('.card.compare .cmp-ins').inner_text(), '| cheap', await pg.locator('.card.compare .cheap-tag').count(), '| ready', await pg.locator('.card.compare .ready-tag').count())
        # upload a photo and get colours
        async with pg.expect_file_chooser() as fc:
            await pg.click('.add-btn'); await pg.click('.add-pop .tool:has-text("Photos or video")')
        ch=await fc.value; await ch.set_files(D+'sample.jpg'); await pg.wait_for_timeout(1200)
        await pg.locator('.card.image .handle button[aria-label^="More"]').click(); await pg.click('.modal .btn:has-text("Get colours")'); await pg.wait_for_timeout(1200)
        print('palettes', await pg.locator('.card.palette').count(), (await pg.locator('.card.palette').last.inner_text())[:80].replace('\n',' '))
        # duplicate photo
        async with pg.expect_file_chooser() as fc:
            await pg.click('.add-btn'); await pg.click('.add-pop .tool:has-text("Photos or video")')
        ch=await fc.value; await ch.set_files(D+'sample.jpg'); await pg.wait_for_timeout(500)
        print('dup warning', await pg.locator('.modal h2').inner_text() if await pg.locator('.modal').count() else 'none')
        await pg.click('.modal-actions .btn:has-text("Cancel")'); await pg.wait_for_timeout(300)
        # tidy
        before=await pg.evaluate("[...document.querySelectorAll('.card')].map(c=>c.offsetLeft+','+c.offsetTop).join(' ')")
        await pg.click('.board-bar .btn:has-text("Tidy up")'); await pg.wait_for_timeout(800)
        after=await pg.evaluate("[...document.querySelectorAll('.card')].map(c=>c.offsetLeft+','+c.offsetTop).join(' ')")
        print('tidy changed', before!=after)
        await pg.screenshot(path=D+'shots/tidy.png')
        # favourites filter
        await pg.click('.findbar button:has-text("Filters")'); await pg.click('.find-chips .filter:has-text("Family favourites")'); await pg.wait_for_timeout(300)
        print('fav', await pg.locator('.find-count').inner_text())
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(500)
        print('overview ready', await pg.locator('.tip.ready').count(), 'favs', await pg.locator('.oblock h2:has-text("Family favourites")').count())
        print('errors', errs)
        await b.close()
asyncio.run(main())
