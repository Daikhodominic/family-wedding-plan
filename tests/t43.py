# Working together + admin control: roles, locks, @mentions, read receipts, who's here, member stats.
import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=53').then(m=>m.store)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}"); await pg.reload(); await pg.wait_for_timeout(700)
        # add family members to talk to
        await pg.evaluate(f"""async()=>{{const s=await {S}; s.cache.members.push({{user_id:'u-elow',name:'Elow Daikho',joined_at:new Date().toISOString(),role:'full'}},{{user_id:'u-aunt',name:'Aunty Rose',joined_at:new Date().toISOString(),role:'view'}}); s.save(); s.emit({{table:'members'}});}}""")
        # 1. @mention makes a job for that person
        await pg.goto(B+'#/w/elow/board'); await pg.wait_for_timeout(900)
        item = await pg.evaluate(f"async()=>{{const s=await {S}; return s.rows('board_items').find(i=>i.wedding_id==='elow'&&!i.deleted_at&&i.kind!=='shape'&&i.kind!=='connector').id}}")
        await pg.evaluate(f"async()=>{{const m=await import('./js/feedback.js?v=53'); m.openThread('{item}')}}"); await pg.wait_for_timeout(500)
        print('mention chips', await pg.locator('.mention-row .lchip').all_inner_texts())
        await pg.locator('.mention-row .lchip:has-text("Elow Daikho")').click()
        await pg.locator('.composer textarea').type('can you call them tomorrow?')
        await pg.locator('.composer .btn:has-text("Send")').click(); await pg.wait_for_timeout(600)
        print('mention shown', await pg.locator('.cm-b .mention').all_inner_texts())
        job = await pg.evaluate(f"async()=>{{const s=await {S}; return s.rows('todos').filter(t=>t.owner==='Elow Daikho').map(t=>t.title)}}")
        print('job for Elow', job); assert job
        # 2. Read receipts
        await pg.evaluate(f"""async()=>{{const s=await {S}; const a=await s.insert('announcements',{{wedding_id:'elow',body:'Reception moves to 5 pm',author_name:s.me.name}}); s.cache.announcement_seen.push({{id:'x1',announcement_id:a.id,created_by:'u-elow'}}); s.emit({{table:'announcement_seen'}});}}""")
        await pg.goto(B+'#/w/elow'); await pg.wait_for_timeout(900)
        print('receipt', await pg.locator('.ann-row').first.inner_text())
        assert 'Seen by 1 of' in await pg.locator('.ann-row').first.inner_text()
        # 3. Who's here
        await pg.evaluate(f"async()=>{{const s=await {S}; s.presence=[{{id:'u-elow',name:'Elow Daikho',room:'elow/choose'}}]; s.emit({{table:'presence'}});}}"); await pg.wait_for_timeout(500)
        print('here dots', await pg.locator('.here-dots').get_attribute('aria-label'))
        # 4. Settings: roles and stats
        await pg.goto(B+'#/settings?tab=family'); await pg.wait_for_timeout(700)
        print('stats', [t.replace('\n',' | ') for t in await pg.locator('.mem-row .mem-who').all_inner_texts()])
        await pg.locator('select[aria-label="Role for Elow Daikho"]').select_option('lists'); await pg.wait_for_timeout(300)
        print('elow role', await pg.evaluate(f"async()=>{{const s=await {S}; return s.cache.members.find(m=>m.user_id==='u-elow').role}}"))
        # 5. Lock a section as admin, then act as a normal full member
        await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(700)
        area = await pg.evaluate(f"async()=>{{const s=await {S}; const a=s.rows('areas').find(a=>a.wedding_id==='elow'&&!a.deleted_at); await s.lock('areas',a.id,'elow'); return a.id}}"); await pg.wait_for_timeout(300)
        print('lock chips', await pg.locator('.lock-chip').count())
        r = await pg.evaluate(f"""async()=>{{const s=await {S}; s.me.isAdmin=false; const st=s.rows('steps').find(x=>x.area_id==='{area}'); const out=[];
            try{{ await s.update('steps', st.id, {{title:'changed'}}); out.push('locked edit allowed'); }}catch(e){{ out.push('locked: '+e.message); }}
            const other=s.rows('steps').find(x=>x.wedding_id==='elow'&&x.area_id!=='{area}');
            try{{ await s.update('steps', other.id, {{notes:'ok'}}); out.push('unlocked edit ok'); }}catch(e){{ out.push('unlocked failed '+e.message); }}
            s.me.role='view';
            try{{ await s.insert('todos',{{wedding_id:'elow',title:'x'}}); out.push('view insert allowed'); }}catch(e){{ out.push('view: '+e.message); }}
            try{{ await s.insert('comments',{{wedding_id:'elow',item_id:'{item}',kind:'comment',body:'hi'}}); out.push('view comment ok'); }}catch(e){{ out.push('view comment failed'); }}
            s.me.role='lists';
            try{{ s.me.role='full'; const l=await s.insert('lists',{{wedding_id:'elow',title:'T',columns:['A']}}); s.me.role='lists'; await s.insert('list_rows',{{list_id:l.id,wedding_id:'elow',cells:['a']}}); out.push('lists row ok'); }}catch(e){{ out.push('lists row failed '+e.message); }}
            try{{ await s.insert('steps',{{wedding_id:'elow',area_id:'{area}',title:'x'}}); out.push('lists step allowed'); }}catch(e){{ out.push('lists: '+e.message); }}
            s.me.role='full'; s.me.isAdmin=true; return out;}}""")
        for x in r: print(' ', x)
        assert r[0].startswith('locked:') and r[1]=='unlocked edit ok' and r[2].startswith('view:') and r[3]=='view comment ok' and r[4]=='lists row ok' and r[5].startswith('lists:')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
