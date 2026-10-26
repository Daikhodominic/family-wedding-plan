import asyncio
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
SETUP = """async()=>{
 const {store}=await import('./js/store.js?v=51');
 const mk=async(c)=>{const cv=document.createElement('canvas'); cv.width=400; cv.height=300; const x=cv.getContext('2d'); const g=x.createLinearGradient(0,0,400,300); g.addColorStop(0,c[0]); g.addColorStop(1,c[1]); x.fillStyle=g; x.fillRect(0,0,400,300); x.fillStyle='rgba(255,255,255,.7)'; x.beginPath(); x.arc(200,150,70,0,7); x.fill(); const b=await new Promise(r=>cv.toBlob(r,'image/jpeg')); return store.uploadBlob(b,'jpg');};
 const steps=(t)=>store.rows('steps').find(x=>x.wedding_id==='charani'&&x.title===t);
 const p1=await mk(['#c9d5de','#637f99']), p2=await mk(['#efe3d3','#c9967f']), p3=await mk(['#dcc9b6','#8f9eaf']);
 const now=new Date().toISOString();
 await store.update('steps', steps('Book the reception venue for the date').id, {locked_at:now, status:'done', lock_note:{with:'Example: Riverside Hall', vendor:'Example: Riverside Hall', phone:'98765 11111', amount:'150000', advance:'50000', image:p1}});
 await store.update('steps', steps('Finalise the menu').id, {locked_at:now, status:'done', lock_note:{with:'Example: Custard cups — Rose Caterers', vendor:'Rose Caterers', phone:'98765 22222', amount:'45 per cup', choice:{title:'Custard cups', image:p2}}});
 await store.update('steps', steps('Arrange transport for guests').id, {locked_at:now, status:'done', lock_note:{with:'Example: Driver Peter', phone:'98765 33333', image:p3}});
}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vp,name in [({'width':1440,'height':900},'d'),({'width':390,'height':844},'m')]:
            pg=await b.new_page(viewport=vp)
            errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(B+'#/w/charani/plan'); await pg.wait_for_timeout(500)
            await pg.evaluate(SETUP); await pg.wait_for_timeout(500)
            await pg.goto(B+'#/w/charani/choose?view=glimpse'); await pg.wait_for_timeout(800)
            print(name,'tiles', await pg.locator('.gl-tile').count(), 'pending', await pg.locator('.gl-tile.pending').count())
            await pg.screenshot(path=D+f'shots/{name}_glimpse.png')
            await pg.goto(B+'#/w/charani/plan'); await pg.wait_for_timeout(500); await pg.click('.viewtoggle button:has-text("Map")'); await pg.wait_for_timeout(800)
            print(name,'decided nodes', await pg.locator('.mnode.decided').count(), 'with pic', await pg.locator('.mnode.decided.with-pic').count())
            await pg.screenshot(path=D+f'shots/{name}_map2.png')
            await pg.goto(B+'#/w/charani'); await pg.wait_for_timeout(700)
            print(name,'strip', await pg.locator('.ds-item').count())
            await pg.screenshot(path=D+f'shots/{name}_ov3.png')
            print(name,'errors', errs)
            await pg.close()
        await b.close()
asyncio.run(main())
