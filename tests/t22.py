import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(600)
        print('dates banner', await pg.locator('.tip.auto').count())
        await pg.click('.tip.auto:has-text("no due date") .tip-x'); await pg.wait_for_timeout(600)
        dues=await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=47'); return store.rows('steps').filter(s=>s.wedding_id==='charani'&&s.due).map(s=>s.title+':'+s.due).slice(0,6)}")
        print('dues', dues)
        print('weekly', (await pg.evaluate("async()=>{const m=await import('./js/planauto.js?v=47'); const {store}=await import('./js/store.js?v=47'); return m.weekSummary(store.find('weddings','charani'))}"))[:300].replace('\n',' / '))
        async with pg.expect_download() as dl:
            await pg.click('.oh-more'); await pg.wait_for_timeout(150); await pg.click('.menu-pop .mi:has-text("calendar")')
        d=await dl.value; path=await d.path(); txt=open(path).read(); print('ics events', txt.count('BEGIN:VEVENT'))
        # looks finished: list on step with all confirmed
        await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=47'); const s=store.rows('steps').find(x=>x.wedding_id==='charani'&&x.title==='Send the invitations');
          const l=await store.insert('lists',{wedding_id:'charani', step_id:s.id, title:'Invites sent', columns:['Name','Card sent']});
          await store.insert('list_rows',{list_id:l.id, wedding_id:'charani', cells:['A','Yes'], position:1}); await store.insert('list_rows',{list_id:l.id, wedding_id:'charani', cells:['B','Yes'], position:2});
          store.cache.announcements.push({id:'an1', wedding_id:null, body:'Reception now starts at 5 pm, not 6 pm.', author_name:'Charani', created_by:'demo-charani', created_at:new Date().toISOString(), deleted_at:null}); store.emit({table:'announcements'});}""")
        await pg.wait_for_timeout(600)
        print('looks finished', await pg.locator('.oblock.looks .orow').count(), 'announce', await pg.locator('.announce').count())
        await pg.screenshot(path=D+'shots/ov_auto.png')
        await pg.click('.announce .an-ok'); await pg.wait_for_timeout(400)
        print('after got it', await pg.locator('.announce').count())
        # final week preview with run sheet
        await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=47'); const l=await store.insert('lists',{wedding_id:'charani', step_id:null, title:'Day-of run sheet', columns:['Time','What','Who','Where','Done']});
          for (const [i,r] of [['09:00','Bride getting ready','Aunty Ela','Home',''],['11:00','Church service','Everyone','Church',''],['13:30','Reception lunch','Caterer','Hall','']].entries()) await store.insert('list_rows',{list_id:l.id, wedding_id:'charani', cells:r, position:i});
          const s=store.rows('steps').find(x=>x.wedding_id==='charani'&&x.title==='Book the reception venue for the date'); await store.update('steps', s.id, {locked_at:new Date().toISOString(), status:'done', lock_note:{with:'Riverside Hall', vendor:'Riverside Hall', phone:'98765 11111'}});}""")
        await pg.goto(B+'#/w/charani?finalweek=1'); await pg.wait_for_timeout(600)
        print('final week', await pg.locator('.final-week').count(), 'run rows', await pg.locator('.fw-r').count(), 'calls', await pg.locator('.fw-call').count())
        await pg.screenshot(path=D+'shots/finalweek.png')
        # copy list + area
        await pg.goto(B+'#/w/charani/plan'); await pg.wait_for_timeout(500); (await pg.locator('.fold-all button:has-text(\"Open all\")').click()) if await pg.locator('.fold-all').count() else None; await pg.wait_for_timeout(300)
        await pg.locator('.area:has-text("Gift preparation") .menu-btn').click(); await pg.click('.modal .btn:has-text("Copy this area to Elow")'); await pg.wait_for_timeout(600)
        n=await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=47'); return store.rows('areas').filter(a=>a.wedding_id==='elow'&&a.title==='Gift preparation'&&!a.deleted_at).length}")
        print('elow gift areas', n)
        # drawer suggested date
        await pg.locator('.step .txt:has-text("Food tasting")').click(); await pg.wait_for_timeout(400)
        print('sugg', await pg.locator('.drawer .sugg').count())
        print('errors', errs)
        await b.close()
asyncio.run(main())
