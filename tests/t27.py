import asyncio
from playwright.async_api import async_playwright
SEED = """async () => { const { store } = await import('./js/store.js?v=48');
  const a = store.rows('areas').find(x => x.wedding_id==='elow' && !x.deleted_at);
  const s1 = await store.insert('steps', { wedding_id:'elow', area_id:a.id, title:'Elow: ask Fr. Thomas about the date', notes:'', owner:'Elow', due:null, status:'todo', position:9000 });
  const s2 = await store.insert('steps', { wedding_id:'elow', area_id:a.id, title:'Elow: pastor list', notes:'', owner:'', due:null, status:'todo', position:9100 });
  const b = await store.insert('board_items', { wedding_id:'elow', kind:'note', x:100, y:100, w:240, z:1, data:{ text:'Elow: suit idea' } });
  const t = await store.insert('todos', { wedding_id:'elow', title:'Elow: call the tailor', notes:'', owner:'Elow', due:null, status:'todo', position:1 });
  for (const [tb, r] of [['steps',s1],['steps',s2],['board_items',b],['todos',t]]) await store.update(tb, r.id, { created_by: 'demo-elow' });
  return 'seeded'; }"""
Q = """async () => { const { store } = await import('./js/store.js?v=48'); const L = (t) => store.rows(t).filter(x => x.wedding_id==='elow' && !x.deleted_at);
  const el = (t) => L(t).filter(x => x.created_by==='demo-elow').map(x => x.title || (x.data||{}).text);
  const kept = L('areas').filter(a => a.title.startsWith('Kept') || a.title.startsWith('Brought')).map(a => a.title);
  return { steps: L('steps').length, todos: L('todos').length, elowSteps: el('steps'), elowCard: el('board_items'), elowTodo: el('todos'), keptAreas: kept }; }"""
async def run(keep):
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow/plan'); await pg.wait_for_timeout(900)
        await pg.evaluate("async () => { const { store } = await import('./js/store.js?v=48'); await store.resetDemo(); }"); await pg.wait_for_timeout(800)
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow/plan'); await pg.wait_for_timeout(900)
        print(await pg.evaluate(SEED))
        await pg.evaluate("location.hash=location.hash.split('?')[0].split('/').slice(0,3).join('/')"); await pg.wait_for_timeout(500)
        if await pg.locator('details.setup-card:not([open]) summary').count(): await pg.click('details.setup-card summary')
        await pg.click('.tip.auto .tip-x:has-text("Load it")'); await pg.wait_for_timeout(300)
        print(' warning:', (await pg.locator('.others-gate').inner_text()).replace('\n',' | '))
        if keep is False: await pg.locator('.others-gate input').uncheck()
        await pg.screenshot(path=f'shots/gate_{keep}.png')
        await pg.click('.modal-actions .btn:has-text("Load the checklist")'); await pg.wait_for_timeout(1500)
        print(' after load (keep=%s):' % keep, await pg.evaluate(Q))
        if keep is False:
            await pg.goto('http://localhost:8765/index.html?demo#/bin'); await pg.wait_for_timeout(900)
            btn = pg.locator('button:has-text("Bring back what others added")')
            print(' bin button:', await btn.all_inner_texts(), '| note:', await pg.locator('.others-note').all_inner_texts())
            await pg.screenshot(path='shots/bin_others.png')
            await btn.first.click(); await pg.wait_for_timeout(1200)
            print(' after bring back:', await pg.evaluate(Q))
        print(' errors', errs); await b.close()
async def main():
    await run(True); await run(False)
asyncio.run(main())
