# Smart add in live mode: the AI (stand-in) fills only what the rules missed; Instagram photos are kept;
# only vendor content is sent; with no AI set up, the rules still work.
import asyncio
from playwright.async_api import async_playwright
L='http://localhost:8765/tests/live.html'
S="import('../js/store.js?v=57').then(m=>m.store)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(L+'#/home'); await pg.evaluate("()=>{for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1'); localStorage.setItem('fwp-smart-mode-w1','\"ask\"')}"); await pg.reload(); await pg.wait_for_timeout(1200)
        await pg.evaluate(f"""async()=>{{const s=await {S}; const st=await s.insert('stages',{{wedding_id:'w1',title:'Before',position:1}}); const a=await s.insert('areas',{{wedding_id:'w1',stage_id:st.id,title:'Decor & flowers',position:1}});
          window.__step=(await s.insert('steps',{{wedding_id:'w1',area_id:a.id,title:'Choose the decorator',status:'todo',position:1,gate:true,lock_note:{{}}}})).id; }}""")
        # stand-in AI: answers about the Instagram link, with one photo from the profile
        await pg.evaluate("""()=>{ window.__smart=(body)=>({ used:'gemini', ai:{ vendors:[{ name:'Tales in Bloom', category_id: window.__step, confidence:0.88, instagram:'tales_in_bloom_event', phone:'98620 55555', price_text:'from 60k', price_value:60000, notes:'Floral and event decor, Kohima', location:'Kohima' }] },
            sites:[], instagram:[{ handle:'tales_in_bloom_event', name:'Tales in Bloom', bio:'Floral & event decor', website:'https://talesinbloom.in', photos:[{ b64:'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHSEfHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', mime:'image/jpeg', permalink:'https://instagram.com/p/1' }] }] }) }""")
        await pg.goto(L+'#/w/w1/choose'); await pg.wait_for_timeout(800)
        await pg.fill('.sa-input', 'https://www.instagram.com/tales_in_bloom_event?dlrf=MTQ5NjFsbGhuaWQzYQ=='); await pg.click('.sa-go'); await pg.wait_for_timeout(1500)
        sent = await pg.evaluate("()=>window.__fnCalls && window.__fnCalls[0].body")
        print('sent to AI: links', sent['links'], '| categories', sent['categories'], '| text', sent['text'][:80])
        assert sent['links']==['https://www.instagram.com/tales_in_bloom_event'] and 'dlrf' not in sent['text']
        print('card', (await pg.locator('.sa-card').first.inner_text()).replace('\n',' | '))
        print('pics in card', await pg.locator('.sa-card .sa-pics img').count())
        await pg.locator('.modal-actions .btn:has-text("Add")').click(); await pg.wait_for_timeout(1500)
        o = await pg.evaluate(f"async()=>{{const s=await {S}; const o=s.rows('board_items').find(i=>i.kind==='option'); return o&&{{title:o.data.title, step:o.data.step_id===window.__step, inbox:!!o.data.inbox, phone:o.data.phone, rate:o.data.rate, links:o.data.links, images:o.data.images.length, loc:o.data.smart.location}}}}")
        print('saved', o); assert o and o['step'] and not o['inbox'] and o['images']==1 and o['phone']=='+91 98620 55555' and o['title']=='Tales in Bloom'
        # no AI: rules alone, and it says so
        await pg.evaluate("()=>{window.__smart=null}")
        await pg.fill('.sa-input', 'Petal Studio florist 70051 11111'); await pg.click('.sa-go'); await pg.wait_for_timeout(1200)
        print('rules only card', (await pg.locator('.sa-card').first.inner_text()).replace('\n',' | ')); assert await pg.locator('.sa-card').count()==1
        await pg.locator('.modal-actions .btn:has-text("Cancel")').click(); await pg.wait_for_timeout(300)
        await pg.fill('.sa-input', 'https://petal.example/?utm_source=x'); await pg.click('.sa-go'); await pg.wait_for_timeout(1200)
        print('no-AI note', await pg.locator('.modal .hint').first.inner_text())
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
