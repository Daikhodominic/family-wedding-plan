# Finds text and buttons that sit on top of each other, or text that spills out of its box.
# Usage: python3 overlap.py [width ...]   (default 360 and 412, the common Android widths)
import asyncio, sys, json
from playwright.async_api import async_playwright
B = 'http://localhost:8765/index.html?demo'
PAGES = ['#/home', '#/w/charani', '#/w/charani/choose', '#/w/charani/swipe', '#/w/charani/plan', '#/w/charani/plan?view=map', '#/w/charani/plan?view=glimpse',
         '#/w/charani/todo', '#/w/charani/board', '#/w/charani/lists', '#/w/charani/budget', '#/w/charani/files',
         '#/w/elow', '#/w/elow/choose', '#/w/elow/plan', '#/w/elow/budget', '#/settings', '#/activity', '#/history', '#/bin', '#/me', '#/budget', '#/swipe',
         '#/p/preview-charani', '#/p/preview-elow']
JS = r"""
() => {
  const vis = (e) => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const hiddenUp = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05 || x.hidden || x.getAttribute('aria-hidden') === 'true') return true; } return false; };
  const ownText = (e) => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const sel = 'button, a, input, select, textarea, label, h1, h2, h3, h4, p, span, b, strong, small, i, li, td, th, div';
  const els = [...document.querySelectorAll(sel)].filter(e => (ownText(e) || /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) && vis(e) && !hiddenUp(e) && !e.closest('.pmap-lines, .demo-flag, svg'));
  const name = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (e.innerText || e.value || e.placeholder || '').trim().slice(0, 28).replace(/\s+/g, ' ') + '"');
  // a text box's real ink: use a Range so padding doesn't count
  const ink = (e) => { if (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) return e.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return b.width ? b : e.getBoundingClientRect(); };
  const fixedOf = (e) => { for (let x = e; x; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return x; } return null; };
  const boxes = els.map(e => ({ e, r: ink(e), f: fixedOf(e) }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    if (a.f !== b.f) continue; // things in a fixed bar are meant to float over the page
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 3 && y > 3) {
      const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if (x * y > small * 0.12) out.push(['overlap', name(a.e), name(b.e), Math.round(a.r.top + scrollY)]);
    }
  }
  // text that spills past its own box, or past the screen
  for (const { e } of boxes) {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (e.scrollWidth > e.clientWidth + 2 && s.overflowX !== 'visible' && s.textOverflow !== 'ellipsis' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !/(auto|scroll)/.test(s.overflowX)) out.push(['clipped', name(e), '', Math.round(r.top + scrollY)]);
    if (r.right > innerWidth + 1 || r.left < -1) { let sc = false; for (let x = e.parentElement; x; x = x.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(x).overflowX) && x.scrollWidth > x.clientWidth) { sc = true; break; } } if (!sc) out.push(['offscreen', name(e), Math.round(r.left) + '..' + Math.round(r.right), Math.round(r.top + scrollY)]); }
  }
  return out;
}
"""
async def main():
    widths = [int(x) for x in sys.argv[1:]] or [360, 412]
    async with async_playwright() as p:
        b = await p.chromium.launch(); total = 0
        for w in widths:
            ctx = await b.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 700, has_touch=w < 700, reduced_motion='reduce'); pg = await ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(B + '#/home'); await pg.wait_for_timeout(500)
            await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1')}")
            for h in PAGES:
                await pg.goto(B.replace('?demo', '?demo&' + (h.split('?')[1] if '?' in h else '')) + h.split('?')[0]) if '?' in h else await pg.goto(B + h)
                if 'view=' in h:
                    v = h.split('view=')[1]; await pg.evaluate(f"()=>{{localStorage.setItem('fwp-view-charani','{v}')}}"); await pg.goto(B + h.split('?')[0])
                await pg.wait_for_timeout(1300)
                res = await pg.evaluate(JS)
                if 'view=' in h: await pg.evaluate("()=>localStorage.removeItem('fwp-view-charani')")
                if res:
                    print(f'--- {w}px {h}  ({len(res)})')
                    for r in res[:25]: print('   ', *r)
                    total += len(res)
            if errs: print('errors', errs)
            await ctx.close()
        print('TOTAL', total); await b.close()
asyncio.run(main())
