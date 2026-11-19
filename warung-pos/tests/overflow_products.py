import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='id-ID', timezone_id='Asia/Makassar')
        page = await ctx.new_page(); errs=[]
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto('http://localhost:8080/')
        await page.fill('input[placeholder="mis. Bu Sri"]', 'Ibu'); await page.click('text=Shift siang'); await page.click('button:has-text("Lanjut")')
        await page.click('button:has-text("Lewati, nanti saja")'); await page.click('text=Pakai data contoh'); await page.click('button:has-text("Mulai berjualan")')
        await page.wait_for_selector('text=Mulai shift siang', timeout=15000); await page.click('button:has-text("Lewati, isi nanti")')
        ids = await page.evaluate("""async()=>{const r=await new Promise(res=>{const q=indexedDB.open('warung-pos');q.onsuccess=()=>res(q.result)});return new Promise(res=>{const t=r.transaction('produk').objectStore('produk').getAll();t.onsuccess=()=>res(t.result.map(p=>p.id))})}""")
        bad=[]
        for w in [360,375,390,412]:
            await page.set_viewport_size({'width':w,'height':780})
            for i in ids:
                for suf in ['', '/ubah']:
                    await page.goto(f'http://localhost:8080/#/produk/{i}{suf}'); await page.wait_for_timeout(150)
                    o = await page.evaluate("document.scrollingElement.scrollWidth - innerWidth")
                    if o>0: bad.append((w,i,suf,o))
            await page.goto('http://localhost:8080/#/kasir'); await page.wait_for_timeout(300)
            if w==360: await page.screenshot(path='tests/shots/siang-kasir-360.png')
        await page.set_viewport_size({'width':360,'height':780})
        await page.goto(f'http://localhost:8080/#/produk/{ids[14]}'); await page.wait_for_timeout(300); await page.screenshot(path='tests/shots/20b-detail-produk.png')
        await page.goto('http://localhost:8080/#/tutup'); await page.wait_for_timeout(300); await page.screenshot(path='tests/shots/28b-tutup-siang.png')
        print('overflow:', bad or 'none', '| produk diperiksa:', len(ids), '| errors:', errs or 'none')
        await b.close()
asyncio.run(main())
