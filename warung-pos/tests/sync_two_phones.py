# Uji sinkronisasi dua HP (shift pagi & siang). Butuh: python3 -m http.server 8080 + salah satu:
#   node tests/gas-emulator.mjs     (menjalankan apps-script/Code.gs asli — disarankan)
#   node tests/mock-apps-script.mjs (tiruan protokol saja)
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
URL='http://localhost:8099/exec'; KODE='TES12345'; res=[]
def ok(c,m): res.append(('PASS ' if c else 'FAIL ')+m)
async def phone(b, nama, shift, pulihkan=False):
    ctx = await b.new_context(viewport={'width':360,'height':780}, is_mobile=True, has_touch=True, locale='id-ID', timezone_id='Asia/Makassar')
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: res.append('FAIL pageerror '+str(e)))
    await pg.goto('http://localhost:8080/')
    await pg.fill('input[placeholder="mis. Bu Sri"]', nama); await pg.click(f'text=Shift {shift}'); await pg.click('button:has-text("Lanjut")')
    await pg.fill('input[placeholder="https://script.google.com/…/exec"]', URL); await pg.fill('input[placeholder="8 huruf/angka"]', KODE)
    await pg.click('.sticky-foot button >> nth=1')
    await pg.click('text=Ambil dari Google Sheets' if pulihkan else 'text=Mulai kosong'); await pg.click('button:has-text("Mulai berjualan")')
    await pg.wait_for_selector(f'text=Mulai shift {shift}'); await pg.click('button:has-text("Lewati, isi nanti")')
    return pg
async def ev(pg, js): return await pg.evaluate(js)
STOK = "async(n)=>{const s=await import('/js/store.js');return [...s.state.produk.values()].find(p=>p.nama===n)?.stok}"
SYNC = "async()=>{const y=await import('/js/sync.js');await y.jalankan();return {mode:y.status.mode,pending:y.status.pending,pesan:y.status.pesan}}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        A = await phone(b, 'Bu Sri', 'pagi')
        # A: barang warung baru, stok 10, lalu jual 2
        await ev(A, """async()=>{const s=await import('/js/store.js');const p=await s.simpanProduk({pemilik:'warung',nama:'Teh Gelas',kategori:'Minuman',satuanDasar:'cup',satuan:[{nama:'cup',isi:1,harga:1500,barcode:''}],modeStok:'hitung',modalPerDasar:1000,stokAwal:10});
          await s.jual({items:[{produkId:p.id,pemilik:'warung',nama:p.nama,satuan:'cup',isi:1,harga:1500,modal:1000,qty:2}],dibayar:3000});}""")
        r = await ev(A, SYNC); ok(r['mode']=='ok' and r['pending']==0, f'HP pagi mengirim semua catatan ({r})')
        n1 = json.load(urllib.request.urlopen('http://localhost:8099/_log'))['rows']
        await ev(A, SYNC); n2 = json.load(urllib.request.urlopen('http://localhost:8099/_log'))['rows']
        ok(n1==n2, f'kirim ulang tidak menggandakan baris ({n1} → {n2})')
        B = await phone(b, 'Ibu', 'siang', pulihkan=True)
        ok(await ev(B, STOK.replace('async(n)','async()').replace('n)',"'Teh Gelas')").replace("p.nama===n","p.nama==='Teh Gelas'")) == 8, 'HP siang memulihkan barang Warung dengan stok 8')
        # B jual 3, A (offline) jual 1 bersamaan, lalu keduanya sinkron
        await ev(B, """async()=>{const s=await import('/js/store.js');const p=[...s.state.produk.values()].find(p=>p.nama==='Teh Gelas');await s.jual({items:[{produkId:p.id,pemilik:'warung',nama:p.nama,satuan:'cup',isi:1,harga:1500,modal:1000,qty:3}],dibayar:5000});}""")
        await ev(A, """async()=>{const s=await import('/js/store.js');const p=[...s.state.produk.values()].find(p=>p.nama==='Teh Gelas');await s.jual({items:[{produkId:p.id,pemilik:'warung',nama:p.nama,satuan:'cup',isi:1,harga:1500,modal:1000,qty:1}],dibayar:1500});}""")
        await ev(B, SYNC); await ev(A, SYNC); await ev(B, SYNC); await ev(A, SYNC)
        sa = await ev(A, "async()=>{const s=await import('/js/store.js');return [...s.state.produk.values()].find(p=>p.nama==='Teh Gelas').stok}")
        sb = await ev(B, "async()=>{const s=await import('/js/store.js');return [...s.state.produk.values()].find(p=>p.nama==='Teh Gelas').stok}")
        ok(sa==4 and sb==4, f'stok sama di kedua HP setelah jual bersamaan: 10−2−3−1 = 4 (pagi {sa}, siang {sb})')
        # B ubah harga → A ikut, stok A tidak tertimpa
        await ev(B, """async()=>{const s=await import('/js/store.js');const p=[...s.state.produk.values()].find(p=>p.nama==='Teh Gelas');await new Promise(r=>setTimeout(r,20));await s.simpanProduk({...p,satuan:[{...p.satuan[0],harga:2000}]});}""")
        await ev(B, SYNC); await ev(A, SYNC)
        pa = await ev(A, "async()=>{const s=await import('/js/store.js');const p=[...s.state.produk.values()].find(p=>p.nama==='Teh Gelas');return [p.satuan[0].harga,p.stok]}")
        ok(pa==[2000,4], f'perubahan harga dari HP siang sampai ke HP pagi, stok tetap 4 ({pa})')
        # batal di A → stok kembali di B
        await ev(A, """async()=>{const s=await import('/js/store.js');const db=await import('/js/db.js');const t=(await db.getAll('penjualan')).find(x=>x.items[0].qty===1);await s.batalkan(t.id,'Salah tekan');}""")
        await ev(A, SYNC); await ev(B, SYNC)
        sb = await ev(B, "async()=>{const s=await import('/js/store.js');return [...s.state.produk.values()].find(p=>p.nama==='Teh Gelas').stok}")
        ok(sb==5, f'pembatalan di HP pagi mengembalikan stok di HP siang (5) → {sb}')
        # kirim ulang data yang PERSIS sama (mis. sinyal putus setelah server menyimpan) tidak boleh menggandakan
        def post(items):
            r=urllib.request.Request(URL, data=json.dumps({'aksi':'kirim','kode':KODE,'device':'hp-uji','items':items}).encode(), headers={'Content-Type':'text/plain;charset=utf-8'})
            return json.load(urllib.request.urlopen(r))
        it=[{'store':'pengeluaran','id':'uji-ulang-1','data':{'id':'uji-ulang-1','waktu':'2026-11-19T00:10:00.000Z','tanggal':'2026-11-19','diubah':'2026-11-19T00:10:00.000Z','kategori':'Gas','nominal':22000,'pemilik':'nasi','dariLaci':True,'catatan':'','status':'aktif'}}]
        a=post(it)['diterima']; b2=post(it)['diterima']
        ok(a==1 and b2==0, f'kiriman ulang identik ditolak sebagai duplikat (pertama {a}, ulang {b2})')
        # kode salah
        r = await ev(A, "async()=>{const y=await import('/js/sync.js');try{await y.tesKoneksi({url:'"+URL+"',kode:'SALAH'});return 'tersambung'}catch(e){return e.message}}")
        ok(r=='Kode salah', f'kode rahasia salah ditolak ({r})')
        await b.close()
asyncio.run(main()); print('\n'.join(res))
