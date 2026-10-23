import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':800}, is_mobile=True, has_touch=True, device_scale_factor=2); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        pops=[]; ctx.on('page', lambda np: pops.append(np.url))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(500)
        # Charani: add the preparations from the plan offer
        await pg.goto(B+'#/w/charani/plan'); await pg.wait_for_timeout(1200)
        print('offer:', await pg.locator('.tip.auto').inner_text() if await pg.locator('.tip.auto').count() else None)
        await pg.locator('.tip.auto .tip-x').click(); await pg.wait_for_timeout(400)
        print('modal:', (await pg.locator('.modal').inner_text())[:200].replace('\n',' | '))
        await pg.locator('.modal button:has-text("Add them")').click(); await pg.wait_for_timeout(1200)
        t=await pg.locator('.toast').all_inner_texts(); print('toast', t); assert any('5 lists' in x for x in t), 'lists not made'
        print('offer after:', await pg.locator('.tip.auto').count())
        print('area', await pg.locator('.area:has-text("Bride’s preparations")').count(), 'steps', await pg.locator('.area:has-text("Bride’s preparations") .step').count())
        await pg.goto(B+'#/w/charani/lists'); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='shots/lists_ch.png', full_page=True)
        print('tiles', await pg.locator('.cust-tile').all_inner_texts())
        print('cards', await pg.locator('.lcard .lc-t').all_inner_texts())
        # open the meat list, add a row with suggestions
        await pg.locator('.cust-tile:has-text("Meat list")').first.click(); await pg.wait_for_timeout(800)
        for name,rel,share,kg in [('Apfü Khrienuo','Grandmother','Pig head','6'),('Uncle Vizo','Maternal uncle','Hind leg','4'),('Uncle Neiki','Paternal uncle','Hind leg','4')]:
            await pg.locator('button:has-text("+ Add a row"), button:has-text("+ Add the first row")').first.click(); await pg.wait_for_timeout(400)
            ins=pg.locator('.ltable tbody tr').last.locator('input')
            for i,v in [(0,name),(1,rel),(3,share),(4,kg)]:
                await ins.nth(i).fill(v); await ins.nth(i).press('Tab')
            await pg.wait_for_timeout(300)
        print('summary', await pg.locator('.lp-sum').inner_text())
        print('datalist', await pg.locator('.ltable tbody tr').first.locator('input').nth(3).get_attribute('list'), await pg.locator('datalist#sg-share option').count())
        msg = await pg.evaluate("async()=>{const m=await import('./js/customs.js?v=42'); const {store}=await import('./js/store.js?v=42'); const l=store.rows('lists').find(x=>x.title.startsWith('Meat list')); return m.listMessage(l)}")
        print('--- message ---\n'+msg); assert 'Pig head' in msg and 'Meat in all: 14 kg' in msg
        await pg.screenshot(path='shots/meat_list.png', full_page=True)
        await pg.locator('button:has-text("Print or save as PDF")').click(); await pg.wait_for_timeout(800)
        print('popups', pops)
        # Elow lists page
        await pg.goto(B+'#/w/elow/lists'); await pg.wait_for_timeout(1000)
        et=await pg.locator('.cust-tile .cust-side').all_inner_texts(); print('elow tiles', et); assert len(et)==4
        await pg.screenshot(path='shots/lists_el.png', full_page=True)
        print('errors', errs)
        await b.close()
asyncio.run(main())
