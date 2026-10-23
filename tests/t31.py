import asyncio, sys
from playwright.async_api import async_playwright
V = sys.argv[1]
B='http://localhost:8765/index.html?demo'
SLOW = """async () => { const { store } = await import('./js/store.js?v=%s'); const wait = (ms) => new Promise(r => setTimeout(r, ms));
  for (const m of ['insert','update','patchMany','del','insertMany']) { const f = store[m] && store[m].bind(store); if (!f) continue;
    store[m] = async (...a) => { await wait(120); const r = await f(...a); const n = m === 'insertMany' || m === 'patchMany' ? (a[1] || []).length : 1;
      for (let i = 0; i < n; i++) setTimeout(() => store.emit({ table: a[0], remote: true }), 200 + i * 15); return r; }; }
  window.__swaps = 0; new MutationObserver(m => { for (const x of m) if (x.type === 'childList' && x.target.id === 'app') window.__swaps++; }).observe(document.getElementById('app'), { childList: true }); }""" % V
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900})
        await pg.goto(B+'#/w/elow/plan'); await pg.wait_for_timeout(900)
        await pg.evaluate(SLOW)
        await pg.click('.tip.auto .tip-x:has-text("Load it")'); await pg.wait_for_timeout(300)
        await pg.click('.modal-actions .btn:has-text("Load the checklist")'); await pg.wait_for_timeout(6000)
        print(V, 'Load it redraws:', await pg.evaluate('window.__swaps'))
        await pg.evaluate("async () => { const { store } = await import('./js/store.js?v=%s'); await store.update('weddings', 'elow', { wedding_date: '2027-02-06' }); }" % V); await pg.wait_for_timeout(1500)
        await pg.goto(B+'#/w/elow'); await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { window.__swaps = 0; }")
        await pg.click('.tip-x:has-text("Fill in dates")'); await pg.wait_for_timeout(16000)
        print(V, 'Fill in dates redraws:', await pg.evaluate('window.__swaps'))
        await b.close()
asyncio.run(main())
