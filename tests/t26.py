import asyncio
from playwright.async_api import async_playwright
Q = """async () => { const { store } = await import('./js/store.js?v=48'); const L = r => (r||[]).filter(x => !x.deleted_at && x.wedding_id==='elow');
  return { stages: L(store.rows('stages')).length, areas: L(store.rows('areas')).length, steps: L(store.rows('steps')).length, todos: L(store.rows('todos')).length,
    board: L(store.rows('board_items')).length, lists: L(store.rows('lists')).length, ex: L(store.rows('todos')).filter(t=>t.title.startsWith('Example')).length,
    firstTodo: (L(store.rows('todos')).sort((a,b)=>a.position-b.position)[0]||{}).title }; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow/plan'); await pg.wait_for_timeout(1000)
        await pg.evaluate("async () => { const { store } = await import('./js/store.js?v=48'); store.resetDemo && 0; }")
        print('before', await pg.evaluate(Q))
        await pg.evaluate("location.hash=location.hash.split('?')[0].split('/').slice(0,3).join('/')"); await pg.wait_for_timeout(500)
        if await pg.locator('details.setup-card:not([open]) summary').count(): await pg.click('details.setup-card summary')
        await pg.click('.tip.auto .tip-x:has-text("Load it")'); await pg.wait_for_timeout(300)
        print('boxes', await pg.locator('.load-clear label').all_inner_texts())
        await pg.screenshot(path='shots/load_modal.png')
        await pg.click('.modal-actions .btn:has-text("Load the checklist")'); await pg.wait_for_timeout(1500)
        print('after', await pg.evaluate(Q), await pg.locator('.toast').all_inner_texts())
        print('offer gone', await pg.locator('.tip.auto:has-text("ready")').count())
        # simulate an older load: delete 3 steps + all todos, then top-up
        await pg.evaluate("""async () => { const { store } = await import('./js/store.js?v=48'); const st = store.rows('steps').filter(s=>s.wedding_id==='elow' && !s.deleted_at && ['Run sheet for the day','Head count','Honeymoon'].includes(s.title));
          for (const s of st) await store.del('steps', s.id); for (const t of store.rows('todos').filter(t=>t.wedding_id==='elow')) await store.del('todos', t.id); }""")
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow'); await pg.wait_for_timeout(900)
        print('topup offer', await pg.locator('.tip.auto').all_inner_texts())
        await pg.evaluate("location.hash=location.hash.split('?')[0].split('/').slice(0,3).join('/')"); await pg.wait_for_timeout(500)
        if await pg.locator('details.setup-card:not([open]) summary').count(): await pg.click('details.setup-card summary')
        await pg.click('.tip.auto .tip-x:has-text("Add them")'); await pg.wait_for_timeout(300)
        await pg.click('.modal-actions .btn:has-text("Add them")'); await pg.wait_for_timeout(1200)
        print('after topup', await pg.evaluate(Q))
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow/todo'); await pg.wait_for_timeout(900)
        await pg.screenshot(path='shots/elow_todo.png')
        await pg.goto('http://localhost:8765/index.html?demo#/w/elow'); await pg.wait_for_timeout(900)
        await pg.screenshot(path='shots/elow_ov2.png')
        print('errors', errs); await b.close()
asyncio.run(main())
