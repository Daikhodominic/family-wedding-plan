# Smart add reads documents: Word, Excel, CSV, PDF (pdf.js stood in), and says when it can't (old .doc).
import asyncio, glob, os
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html?demo'
S="import('./js/store.js?v=57').then(m=>m.store)"
HERE=os.path.dirname(os.path.abspath(__file__))
FAKE_PDFJS = """export const GlobalWorkerOptions = {};
export function getDocument(){ return { promise: Promise.resolve({ numPages: 2, getPage: async (i) => ({ getTextContent: async () => ({ items: i===1 ? [{str:'Royal Feast Caterers', transform:[0,0,0,0,0,700]}, {str:'Wedding menu · ₹750 per plate', transform:[0,0,0,0,0,680]}, {str:'Call 70051 55555', transform:[0,0,0,0,0,660]}] : [] }) }) }) }; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}, is_mobile=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/pdfjs-dist@*/build/pdf.min.mjs', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_PDFJS))
        await pg.goto(B+'#/home'); await pg.evaluate("()=>{localStorage.clear(); for(const k of ['welcome','welcome-off','guide']) localStorage.setItem('fwp-once-'+k,'1'); localStorage.setItem('fwp-smart-mode-elow','\"ask\"')}"); await pg.reload(); await pg.wait_for_timeout(700)
        await pg.goto(B+'#/w/elow/choose'); await pg.wait_for_timeout(900)
        acc = await pg.locator('.sa-bar input[type=file]').get_attribute('accept'); print('accept', acc); assert '.pdf' in acc and '.docx' in acc
        nf = await pg.evaluate(f"async()=>{{const s=await {S}; return s.rows('files').filter(f=>!f.deleted_at).length}}")
        files = sorted(glob.glob(HERE+'/docs/*'))
        await pg.locator('.sa-bar input[type=file]').set_input_files(files); await pg.wait_for_timeout(300)
        print('tray', await pg.locator('.sa-thumb.doc').count()); assert await pg.locator('.sa-thumb.doc').count()==5
        await pg.click('.sa-go'); await pg.wait_for_timeout(2500)
        cards = [t.replace('\n',' | ')[:170] for t in await pg.locator('.sa-card').all_inner_texts()]
        names = await pg.locator('.sa-card .sa-top input:not([type=checkbox])').evaluate_all("els=>els.map(e=>e.value)")
        for c in cards: print('  card', c)
        print('names', names); print('warn', await pg.locator('.sa-warn').all_inner_texts())
        await pg.screenshot(path=HERE+'/shots/smart_docs.png')
        for want in ['Zeliang', 'Hornbill', 'Sweet Tooth', 'Royal Feast']: assert any(want in n for n in names), want
        assert 'old.doc' in ' '.join(await pg.locator('.sa-warn').all_inner_texts())
        await pg.locator('.modal-actions .btn:has-text("Add")').click(); await pg.wait_for_timeout(1800)
        res = await pg.evaluate(f"""async()=>{{const s=await {S}; const fs=s.rows('files').filter(f=>!f.deleted_at);
          const os=s.rows('board_items').filter(i=>i.kind==='option'&&!i.deleted_at&&(i.data.docs||[]).length);
          return {{ files: fs.length, opts: os.map(o=>[o.data.title, o.data.phone, o.data.rate, o.data.docs.map(id=>(s.find('files',id)||{{}}).title).join(','), (s.find('files',o.data.docs[0])||{{}}).step_id===(o.data.step_id||null)]) }}}}""")
        print('files', nf, '->', res['files']); [print('  ', o) for o in res['opts']]
        assert res['files']==nf+5 and len(res['opts'])>=4 and all(o[4] for o in res['opts'])
        z = next(o for o in res['opts'] if 'Zeliang' in o[0]); assert '98620 77777' in (z[1] or '').replace('+91 ','') and '.docx' in z[3]
        # the vendor's profile shows its document
        await pg.evaluate(f"async()=>{{const s=await {S}; const m=await import('./js/swipe.js?v=57'); const o=s.rows('board_items').find(i=>i.kind==='option'&&/Zeliang/.test(i.data.title||'')); m.openProfile(o)}}"); await pg.wait_for_timeout(600)
        print('profile docs', await pg.locator('.pf-docs .ftile').count(), await pg.locator('.pf-docs .ft-name').all_inner_texts()); assert await pg.locator('.pf-docs .ftile').count()>=1
        await pg.screenshot(path=HERE+'/shots/smart_docs_profile.png')
        print('errors', errs); assert not errs
        await b.close()
asyncio.run(main())
