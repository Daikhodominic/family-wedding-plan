import asyncio, json
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
ROUTES=['#/home','#/w/charani','#/w/charani/choose','#/w/charani/plan','#/w/charani/plan?view=map','#/w/charani/plan?view=glimpse','#/w/charani/todo','#/w/charani/lists','#/w/charani/budget','#/w/charani/board','#/w/charani/decide','#/w/elow','#/me','#/history','#/bin','#/settings','#/budget','#/swipe']
JS="""()=>{const lum=(c)=>{const m=c.match(/[\\d.]+/g); if(!m) return null; const [r,g,b,a]=[+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]; return {l:(0.299*r+0.587*g+0.114*b)/255,a}};
 const bad=[]; for(const el of document.querySelectorAll('body *')){ if(!el.childNodes.length) continue; const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1); if(!txt) continue;
  const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||cs.opacity==='0') continue; const r=el.getBoundingClientRect(); if(!r.width||!r.height) continue;
  const fg=lum(cs.color); let e=el, bg=null; while(e){const b=lum(getComputedStyle(e).backgroundColor); if(b&&b.a>0.55){bg=b;break} e=e.parentElement}
  if(!fg||!bg) continue; if(Math.abs(fg.l-bg.l)<0.28) bad.push((el.className&&el.className.baseVal===undefined?el.className:el.tagName).toString().slice(0,40)+' | '+el.textContent.trim().slice(0,30)+' | fg '+fg.l.toFixed(2)+' bg '+bg.l.toFixed(2)) }
 return [...new Set(bad)].slice(0,12)}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:120])); pg.on('console', lambda m: errs.append(m.text[:120]) if m.type=='error' else None)
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{localStorage.setItem('fwp-once-welcome','1');localStorage.setItem('fwp-once-guide','1')}")
        for r in ROUTES:
            await pg.goto(B+r); await pg.wait_for_timeout(1100)
            res=await pg.evaluate(JS)
            if res: print(r, json.dumps(res, ensure_ascii=False))
        print('errors', errs[:10]); await b.close()
asyncio.run(main())
