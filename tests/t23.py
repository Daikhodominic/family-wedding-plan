import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(500)
        await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=44'); const s=store.rows('steps').find(x=>x.wedding_id==='charani'&&x.title==='Book the reception venue for the date'); await store.update('steps', s.id, {locked_at:new Date().toISOString(), status:'done', lock_note:{with:'Riverside Hall', phone:'98765 11111', amount:'150000', advance:'50000'}});
          const c=store.find('board_items','demo-compare'); store.cache.board_items.find(x=>x.kind==='contact'&&x.wedding_id==='charani').data.phone='99999 00000';}""")
        await pg.click('.oh-more'); await pg.wait_for_timeout(150); await pg.click('.menu-pop .mi:has-text("Share with the partner family")'); await pg.wait_for_timeout(300)
        await pg.locator('.pl-new input').fill("Adahrii's family"); await pg.click('.pl-new .btn'); await pg.wait_for_timeout(400)
        url=await pg.locator('.pl-url').first.inner_text(); print('link', url[-60:])
        token=url.split('#/p/')[1]
        await pg.goto(B+'#/p/'+token); await pg.wait_for_timeout(800)
        txt=await pg.locator('.pview').inner_text()
        print('partner page', await pg.locator('.pv-card').count(), 'cards ·', await pg.locator('.gl-tile').count(), 'decisions')
        print('leaks: price' , '150000' in txt or '1,50,000' in txt or '50000' in txt, '| phone', '98765' in txt or '99999' in txt, '| contact card', 'Example florist' in txt)
        await pg.screenshot(path=D+'shots/partner_d.png', full_page=False)
        await pg.locator('.pv-card').first.locator('.rx').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('.pv-card.compare .vote.up').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('.pv-general textarea').fill('Could we have a vegetarian table?'); await pg.click('.pv-general .btn'); await pg.wait_for_timeout(400)
        print('mine', await pg.locator('.pv-mine p').count())
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(500)
        print('family sees partner sugg', await pg.locator('.partner-sugg .orow').count())
        await pg.goto(B+'#/p/preview-charani'); await pg.wait_for_timeout(600)
        print('preview banner', (await pg.locator('.pv-banner').inner_text())[:40])
        await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(400)
        await pg.screenshot(path=D+'shots/partner_m.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
