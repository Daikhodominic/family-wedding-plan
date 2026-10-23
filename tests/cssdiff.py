# Shoot a fixed set of pages at phone + laptop size into shots/<tag>/; with two tags, compare them.
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
B='http://localhost:8765/index.html?demo'
PAGES=['#/home','#/w/charani','#/w/charani/plan','#/w/charani/map','#/w/charani/swipe','#/w/charani/board','#/w/charani/budget','#/w/charani/choose','#/w/charani/lists','#/w/elow','#/w/elow/plan','#/w/elow/map','#/w/elow/swipe','#/w/elow/choose','#/settings','#/activity','#/p/preview-charani','#/p/preview-elow']
async def shoot(tag):
    os.makedirs('shots/'+tag,exist_ok=True)
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vw,(w,hh,mob) in {'m':(360,780,True),'d':(1280,860,False)}.items():
            ctx=await b.new_context(viewport={'width':w,'height':hh}, is_mobile=mob, has_touch=mob, device_scale_factor=1, reduced_motion='reduce'); pg=await ctx.new_page()
            errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
            await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','guide']) localStorage.setItem('fwp-once-'+k,'1')}")
            for i,h in enumerate(PAGES):
                await pg.goto(B+h); await pg.wait_for_timeout(1400)
                await pg.evaluate("()=>{const d=document.querySelector('.demo-flag'); if(d) d.remove(); document.querySelectorAll('*').forEach(e=>{e.style.animation='none';e.style.transition='none'})}")
                await pg.wait_for_timeout(250)
                await pg.screenshot(path=f'shots/{tag}/{vw}{i:02d}.png', full_page=True)
            if errs: print(vw,errs)
            await ctx.close()
        await b.close()
def compare(a,b):
    for f in sorted(os.listdir('shots/'+a)):
        A=Image.open(f'shots/{a}/{f}').convert('RGB'); Bm=Image.open(f'shots/{b}/{f}').convert('RGB')
        if A.size!=Bm.size: print(f,'SIZE',A.size,Bm.size); continue
        d=ImageChops.difference(A,Bm); bb=d.getbbox()
        if bb:
            n=sum(1 for px in d.getdata() if max(px)>24)
            print(f,'diff px',n,'box',bb)
    print('compared')
if len(sys.argv)==2: asyncio.run(shoot(sys.argv[1]))
else: compare(sys.argv[1],sys.argv[2])
