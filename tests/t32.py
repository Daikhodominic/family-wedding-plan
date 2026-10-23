import asyncio, json
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("window.__opened=[]; window.open=(u)=>{window.__opened.push(u); return null;};")
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(1000)
        for s in ['Skip','Got it']:
            if await pg.locator(f'button:has-text("{s}")').count(): await pg.locator(f'button:has-text("{s}")').first.click()
        # profile: add a number
        await pg.click('.avatar'); await pg.wait_for_timeout(200)
        print('menu', await pg.locator('.menu-pop .mi').all_inner_texts())
        await pg.click('.menu-pop .mi:has-text("Your name")'); await pg.wait_for_timeout(300)
        await pg.fill('.modal input[type=tel]', '12'); await pg.click('.modal-actions .btn:has-text("Save")'); await pg.wait_for_timeout(300)
        print('bad number keeps modal', await pg.locator('.modal').count())
        await pg.fill('.modal input[type=tel]', '98765 43210'); await pg.click('.modal-actions .btn:has-text("Save")'); await pg.wait_for_timeout(400)
        print('phone saved', await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=42'); return store.me.phone}"))
        # give Charani a number (as if she saved it)
        await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=42'); store.upsertLocal('members',{user_id:'demo-charani',phone:'9000000001'}); store.save(); store.emit({table:'members'});}")
        # step drawer button
        await pg.goto(B+'#/w/charani/plan'); await pg.wait_for_timeout(900)
        await pg.click('.fold-all button >> nth=0'); await pg.wait_for_timeout(300)
        sid = await pg.evaluate("async()=>{const {store}=await import('./js/store.js?v=42'); const s=store.rows('steps').find(x=>x.wedding_id==='charani'&&!x.locked_at&&!x.deleted_at&&x.status!=='done'); await store.update('steps',s.id,{owner:'Charani'}); return s.id}")
        await pg.goto(B+f'#/w/charani/plan?open={sid}'); await pg.wait_for_timeout(1200)
        print('drawer wa', await pg.locator('.drawer .d-wa .wa-btn').inner_text())
        await pg.click('.drawer .d-wa .wa-btn'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='shots/wa_drawer.png')
        # overview nudge
        await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(1200)
        n = await pg.locator('.p-wa').count(); print('nudge buttons', n)
        if n: await pg.locator('.p-wa').first.click()
        # choose page
        await pg.goto(B+'#/w/charani/choose'); await pg.wait_for_timeout(1000)
        print('choose wa', await pg.locator('.wa-btn').count())
        await pg.locator('.wa-btn').first.click()
        op = await pg.evaluate('window.__opened')
        for u in op: print('OPEN', u[:60], '|', __import__('urllib.parse').parse.unquote(u.split('text=')[1])[:220].replace('\n',' / '))
        # notifications
        await ctx.grant_permissions(['notifications'], origin='http://localhost:8765')
        await pg.evaluate("""async()=>{ window.__notes=[]; const R=window.Notification; window.Notification=function(t,o){window.__notes.push([t,o.body,o.data&&o.data.url]); return {close(){}};}; window.Notification.permission='granted'; window.Notification.requestPermission=async()=>'granted';
          Object.defineProperty(document,'visibilityState',{get:()=>'hidden'}); document.hasFocus=()=>false; }""")
        await pg.click('.avatar'); await pg.click('.menu-pop .mi:has-text("Notifications")'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/notify_sheet.png')
        await pg.click('.modal-actions .btn:has-text("Turn on")'); await pg.wait_for_timeout(500)
        await pg.evaluate("""async()=>{const {store}=await import('./js/store.js?v=42'); const s=store.rows('steps').find(x=>x.wedding_id==='elow'&&!x.deleted_at);
           store.simulateRemote('board_items',{id:crypto.randomUUID(),wedding_id:'elow',kind:'option',created_by:'demo-elow',data:{step_id:s.id,title:'Rose cake',rate:'₹6,000',images:[]}});
           store.simulateRemote('steps',{...s, owner:'You'},'UPDATE'); }""")
        await pg.wait_for_timeout(3500)
        print('notes', json.dumps(await pg.evaluate('window.__notes'), ensure_ascii=False))
        print('errors', errs)
        await b.close()
asyncio.run(main())
