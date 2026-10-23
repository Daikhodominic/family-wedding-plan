# Phone screenshots (real fonts) of pages and pop-ups, stitched into sheets of four.
import asyncio, sys
from playwright.async_api import async_playwright
from PIL import Image
B='http://localhost:8765/index.html?demo'
W=int(sys.argv[1]) if len(sys.argv)>1 else 360
TAG=sys.argv[3] if len(sys.argv)>3 else 'sheet'
import json
STEPS=json.loads(sys.argv[2]) if len(sys.argv)>2 else [('home','#/home',None),('ov','#/w/charani',None),('choose','#/w/charani/choose',None),('swipe','#/w/charani/swipe',None),
 ('plan','#/w/charani/plan',None),('todo','#/w/charani/todo',None),('lists','#/w/charani/lists',None),('budget','#/w/charani/budget',None),
 ('elow','#/w/elow',None),('echoose','#/w/elow/choose',None),('eplan','#/w/elow/plan',None),('settings','#/settings',None),
 ('drawer','#/w/charani/plan','step'),('menu','#/w/charani','menu'),('addopt','#/w/charani/choose','cat'),('me','#/me',None)]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':W,'height':800}, is_mobile=W<700, has_touch=W<700, device_scale_factor=2, reduced_motion='reduce'); pg=await ctx.new_page()
        await pg.goto(B+'#/home'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','guide']) localStorage.setItem('fwp-once-'+k,'1')}")
        await pg.reload(); await pg.wait_for_timeout(400)
        fs=[]
        for name,h,act in STEPS:
            if h=='#/': await pg.goto(B.split('?')[0]+'#/'); await pg.wait_for_timeout(1500); f=f'shots/look_{name}.png'; await pg.screenshot(path=f); fs.append(f); continue
            await pg.goto(B+h); await pg.wait_for_timeout(1300)
            await pg.evaluate("()=>{const d=document.querySelector('.demo-flag'); if(d) d.remove()}")
            try:
                if act=='step': await pg.locator('.step .txt').first.click(); await pg.wait_for_timeout(700)
                if act=='menu': await pg.locator('.shead .avatar, .shead .me-btn, .shead button[aria-label*=enu]').last.click(); await pg.wait_for_timeout(500)
                if act=='cat': await pg.locator('.cat-tile, .cat-h').first.click(); await pg.wait_for_timeout(800)
            except Exception as e: print(name,'action failed',str(e)[:80])
            f=f'shots/look_{name}.png'; await pg.screenshot(path=f); fs.append(f)
        for k in range(0,len(fs),4):
            ims=[Image.open(f) for f in fs[k:k+4]]
            o=Image.new('RGB',(sum(i.width for i in ims)+20*3,max(i.height for i in ims)),'white'); x=0
            for i in ims: o.paste(i,(x,0)); x+=i.width+20
            o=o.resize((o.width//2,o.height//2)); o.save(f'shots/look_{TAG}{k//4}.png')
        await b.close()
asyncio.run(main())
