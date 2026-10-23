import asyncio, base64
from playwright.async_api import async_playwright
D=''
B='http://localhost:8765/index.html?demo'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctxx=await b.new_context(viewport={'width':1440,'height':900}); pg=await ctxx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/w/charani/board'); await pg.wait_for_timeout(700)
        n=lambda: pg.evaluate("document.querySelectorAll('.card').length")
        print('start cards', await n())
        # multi upload 3 images -> collage
        async with pg.expect_file_chooser() as fc:
            await pg.click('.add-btn'); await pg.click('.add-pop .tool:has-text("Photos or video")')
        ch=await fc.value; await ch.set_files([D+'sample.jpg']*3); await pg.wait_for_timeout(400)
        print('layout modal', await pg.locator('.lay-opt').count())
        await pg.click('.lay-opt:has-text("Collage")'); await pg.wait_for_timeout(1500)
        print('gallery cards', await pg.locator('.card.gallery').count(), 'imgs', await pg.locator('.card.gallery .gal-i').count())
        # undo the collage
        await pg.click('.undo-btn'); await pg.wait_for_timeout(400)
        print('after undo gallery', await pg.locator('.card.gallery').count())
        # checklist
        await pg.click('.add-btn'); await pg.click('.add-pop .tool:has-text("Checklist")'); await pg.wait_for_timeout(300)
        await pg.locator('.modal textarea').fill('Buy ribbons\nBook tailor'); await pg.click('.modal-actions .btn:has-text("Save")'); await pg.wait_for_timeout(300)
        await pg.locator('.card.checklist .ck-tick').first.click(); await pg.wait_for_timeout(300)
        print('checklist', await pg.locator('.card.checklist .by').first.inner_text())
        await pg.locator('.card.checklist .ck-add').fill('Order cake'); await pg.locator('.card.checklist .ck-add').press('Enter'); await pg.wait_for_timeout(300)
        print('checklist items', await pg.locator('.card.checklist .ck li').count())
        # multi-select via ctrl-click on handles, then column
        handles=pg.locator('.card .handle')
        await handles.nth(0).click(modifiers=['Control']); await handles.nth(1).click(modifiers=['Control']); await handles.nth(2).click(modifiers=['Control'])
        await pg.wait_for_timeout(300)
        print('picked', await pg.locator('.card.picked').count(), 'groupbar', await pg.locator('.groupbar').count())
        await pg.screenshot(path=D+'shots/m1.png')
        await pg.click('.groupbar .dt:has-text("Column")'); await pg.wait_for_timeout(500)
        xs=await pg.evaluate("[...document.querySelectorAll('.card.picked')].map(c=>c.offsetLeft)")
        print('column xs', xs)
        await pg.click('.undo-btn'); await pg.wait_for_timeout(500)
        xs2=await pg.evaluate("[...document.querySelectorAll('.card.picked')].map(c=>c.offsetLeft)")
        print('undo xs', xs2)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        # group drag
        # search
        await pg.locator('.find-in input').fill('hydrangea'); await pg.wait_for_timeout(300)
        print('search count', await pg.locator('.find-count').inner_text(), 'dim', await pg.locator('.card.dim').count())
        await pg.locator('.find-in input').fill(''); await pg.wait_for_timeout(200)
        await pg.click('.findbar button:has-text("Filters")'); await pg.wait_for_timeout(200); await pg.click('.find-chips .filter:has-text("With suggestions")'); await pg.wait_for_timeout(300)
        print('filter count', await pg.locator('.find-count').inner_text())
        await pg.click('.find-chips .filter:has-text("Everything")'); await pg.wait_for_timeout(300)
        # paste text and url
        await pg.evaluate("""()=>{const dt=new DataTransfer(); dt.setData('text/plain','https://www.pinterest.com/pin/123'); document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt}));}"""); await pg.wait_for_timeout(500)
        await pg.evaluate("""()=>{const dt=new DataTransfer(); dt.setData('text/plain','Pasted idea: gold napkins'); document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt}));}"""); await pg.wait_for_timeout(500)
        print('after paste cards', await n(), 'links', await pg.locator('.card.link').count())
        # drop a file
        data=base64.b64encode(open(D+'sample.jpg','rb').read()).decode()
        await pg.evaluate("""async (b64)=>{const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
           const f=new File([u],'dropped.jpg',{type:'image/jpeg'}); const dt=new DataTransfer(); dt.items.add(f);
           const v=document.querySelector('.board-view'); const r=v.getBoundingClientRect();
           v.dispatchEvent(new DragEvent('dragenter',{dataTransfer:dt,bubbles:true,clientX:r.left+600,clientY:r.top+300}));
           v.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true,clientX:r.left+600,clientY:r.top+300}));}""", data)
        await pg.wait_for_timeout(1200)
        print('after drop images', await pg.locator('.card.image').count())
        # comments on drawing: draw a box
        await pg.click('.palette.closed .dt'); await pg.wait_for_timeout(200)
        await pg.click('.palette .dt[aria-label="Box"]'); await pg.wait_for_timeout(200)
        v=await pg.locator('.board-view').bounding_box()
        await pg.mouse.move(v['x']+900,v['y']+450); await pg.mouse.down(); await pg.mouse.move(v['x']+1000,v['y']+520,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(400)
        await pg.click('.palette .dt[aria-label="Move & pan"]'); await pg.wait_for_timeout(200)
        await pg.mouse.click(v['x']+900,v['y']+480); await pg.wait_for_timeout(300)
        print('selbar comment', await pg.locator('.selbar .dt:has-text("Comment")').count())
        # marquee with box tool
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.click('.palette .dt[aria-label="Select several cards"]'); await pg.wait_for_timeout(200)
        await pg.mouse.move(v['x']+5,v['y']+5); await pg.mouse.down(); await pg.mouse.move(v['x']+700,v['y']+400,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(400)
        print('marquee picked', await pg.locator('.card.picked').count())
        await pg.screenshot(path=D+'shots/m2.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
