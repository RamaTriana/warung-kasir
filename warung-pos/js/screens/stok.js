// BARANG MASUK & BARANG KELUAR. Stok sebelum → sesudah selalu terlihat sebelum disimpan.
import { h, icon, iconButton, button, header, chip, segmented, field, moneyInput, qtyControl, lapakTag, stockTag, toast, confirmDialog, empty, alertBox } from '../ui.js';
import { state, daftarProduk, barangMasuk, barangKeluar, cariBarcode, ALASAN_KELUAR } from '../store.js';
import { teksStok, angka, rupiah, parseQty } from '../format.js';
import { bukaScanner } from '../scanner.js';

// Pemilih barang: cari nama/barcode atau scan
function pemilihBarang(onPick, { filter = () => true, placeholder = 'Cari atau scan barang…' } = {}) {
  const results = h('div');
  const input = h('input', { type: 'search', placeholder, 'aria-label': 'Cari barang', autocomplete: 'off' });
  function cari() {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.replaceChildren(); return; }
    const arr = daftarProduk().filter(filter).filter((p) => p.nama.toLowerCase().includes(q) || p.satuan.some((u) => u.barcode?.includes(q))).slice(0, 6);
    results.replaceChildren(arr.length ? h('div', { class: 'list', role: 'listbox' }, arr.map((p) => h('button', { type: 'button', class: 'list-item', role: 'option', style: { minHeight: '56px' }, onClick: () => { input.value = ''; results.replaceChildren(); onPick(p); } },
      h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, p.nama), h('span', { class: 'li-sub' }, lapakTag(p.pemilik), stockTag(p))), icon('plus', 'icon-sm'))))
      : h('p', { class: 'secondary', style: { padding: '8px 4px' } }, 'Tidak ketemu. ', h('a', { class: 'link', href: '#/produk/baru' }, 'Tambah barang baru')));
  }
  input.addEventListener('input', cari);
  const scan = () => bukaScanner({ judul: 'Scan barang', lanjut: false, onCode: (code) => { const r = cariBarcode(code); if (r && filter(r.produk)) { onPick(r.produk, r.satuan); return { ok: true, label: r.produk.nama }; } setTimeout(() => toast(`Barcode ${code} belum terdaftar`, { kind: 'warning' }), 50); return { ok: false }; } });
  return h('div', { class: 'stack', style: { gap: '8px' } },
    h('div', { class: 'row', style: { gap: '8px' } }, h('label', { class: 'search grow' }, icon('search'), input), h('button', { type: 'button', class: 'btn btn-secondary', style: { width: '56px', padding: 0 }, 'aria-label': 'Scan barcode', onClick: scan }, icon('scan'))),
    results);
}

// ---- Barang masuk -------------------------------------------------------------
export function masukScreen(ctx) {
  const items = [];
  let pemasok = '', dariLaci = null, catatan = '', err = '';
  const list = h('div', { class: 'stack' });
  const summary = h('div');
  const extra = h('div', { class: 'stack', style: { gap: '16px' } });

  function tambah(p, u) {
    const sat = u || p.satuan.slice().sort((a, b) => b.isi - a.isi)[0]; // default: satuan terbesar (beli per dus/bungkus)
    const ada = items.find((i) => i.produkId === p.id && i.satuanId === sat.id);
    if (ada) ada.qty += 1;
    else items.push({ produkId: p.id, satuanId: sat.id, satuan: sat.nama, isi: sat.isi, qty: 1, hargaBeli: Math.round((p.modalPerDasar || 0) * sat.isi) });
    render();
  }
  const semuaHarian = () => items.length && items.every((i) => state.produk.get(i.produkId).modeStok === 'harian');

  function render() {
    list.replaceChildren(...items.map((it, idx) => {
      const p = state.produk.get(it.produkId);
      const harian = p.modeStok === 'harian';
      const after = (p.stok || 0) + it.qty * it.isi;
      const preview = h('div', { class: 'li-sub' }, 'Stok: ', h('strong', { class: 'tnum' }, teksStok(p)), ' → ', h('strong', { class: 'tnum', style: { color: 'var(--color-success)' } }, teksStok({ ...p, stok: after })));
      const upd = () => { preview.replaceChildren('Stok: ', h('strong', { class: 'tnum' }, teksStok(p)), ' → ', h('strong', { class: 'tnum', style: { color: 'var(--color-success)' } }, teksStok({ ...p, stok: (p.stok || 0) + it.qty * it.isi }))); renderSummary(); };
      return h('div', { class: 'card stack', style: { gap: '12px' } },
        h('div', { class: 'row-between' }, h('div', null, h('div', { class: 'li-title' }, p.nama), lapakTag(p.pemilik)), iconButton('trash', 'Hapus ' + p.nama, () => { items.splice(idx, 1); render(); })),
        p.satuan.length > 1 ? h('div', { class: 'chips' }, p.satuan.map((u) => chip(`${u.nama}${u.isi > 1 ? ` (isi ${angka(u.isi)})` : ''}`, it.satuanId === u.id, () => { it.satuanId = u.id; it.satuan = u.nama; it.isi = u.isi; it.hargaBeli = Math.round((p.modalPerDasar || 0) * u.isi); render(); }))) : null,
        h('div', { class: 'row', style: { alignItems: 'flex-end', flexWrap: 'wrap' } },
          field(`Jumlah (${it.satuan})`, qtyControl(it.qty, (v) => { it.qty = v; upd(); }, { min: 1 })),
          harian ? null : h('div', { class: 'grow', style: { minWidth: '150px' } }, field(`Harga beli per ${it.satuan}`, moneyInput(it.hargaBeli, (v) => { it.hargaBeli = v; renderSummary(); }), { optional: true }))),
        preview);
    }));
    extra.hidden = !items.length;
    extra.replaceChildren(...(semuaHarian() ? [] : [
      field('Dibeli dari', h('input', { class: 'input', value: pemasok, placeholder: 'mis. Toko Sinar, sales Indomie', onInput: (e) => (pemasok = e.target.value) }), { optional: true }),
      field('Uang belanja diambil dari laci?', segmented('laci', [['ya', 'Ya, dari laci'], ['tidak', 'Tidak']], dariLaci == null ? null : dariLaci ? 'ya' : 'tidak', (v) => { dariLaci = v === 'ya'; err = ''; renderSummary(); }),
        { help: 'Penting untuk mencocokkan uang saat tutup shift. Tidak mengurangi laba hari ini.', error: err }),
    ]));
    renderSummary();
  }
  function renderSummary() {
    const total = items.reduce((s, i) => s + i.qty * i.hargaBeli, 0);
    summary.replaceChildren(items.length && !semuaHarian() ? h('div', { class: 'row-between card' }, h('span', { class: 'stat-label' }, 'Total belanja'), h('span', { class: 'price price-md' }, rupiah(total))) : null);
  }

  async function simpan() {
    if (!items.length) { toast('Pilih barang dulu', { kind: 'error' }); return; }
    const harian = semuaHarian();
    if (!harian && dariLaci == null) { err = 'Pilih salah satu'; render(); return; }
    await barangMasuk({ pemasok, dariLaci: harian ? false : dariLaci, items, catatan });
    toast(harian ? 'Stok hari ini disimpan' : `Stok ${items.length} barang bertambah`);
    ctx.go(ctx.query.produk ? '/produk/' + ctx.query.produk : '/barang');
  }

  if (ctx.query.produk && state.produk.get(ctx.query.produk)) tambah(state.produk.get(ctx.query.produk));
  render();
  const harianTitle = ctx.query.produk && state.produk.get(ctx.query.produk)?.modeStok === 'harian';
  return h('div', null,
    header({ title: harianTitle ? 'Isi stok hari ini' : 'Barang masuk', back: ctx.query.produk ? '#/produk/' + ctx.query.produk : '#/barang' }),
    h('div', { class: 'page' },
      pemilihBarang(tambah, { filter: (p) => p.modeStok !== 'tanpa' }),
      items.length ? null : h('p', { class: 'secondary' }, 'Cari atau scan barang yang baru datang. Bisa lebih dari satu barang sekaligus.'),
      list, summary, extra,
      h('div', { class: 'sticky-foot' }, button('Simpan', { size: 'lg', block: true, icon: 'check', onClick: simpan }))));
}

// ---- Barang keluar / koreksi -------------------------------------------------------------------
export function keluarScreen(ctx) {
  let p = ctx.query.produk ? state.produk.get(ctx.query.produk) : null;
  let jenis = null, qty = 1, satuan = null, stokSebenarnya = '', catatan = '';
  let errs = {};
  const body = h('div', { class: 'stack', style: { gap: '20px' } });

  function render() {
    if (!p) { body.replaceChildren(pemilihBarang((x) => { p = x; satuan = x.satuan[0]; render(); }, { filter: (x) => x.modeStok !== 'tanpa' }), h('p', { class: 'secondary' }, 'Untuk barang rusak, kedaluwarsa, dipakai sendiri, hilang, atau mencocokkan hasil hitung stok.')); return; }
    satuan = satuan || p.satuan[0];
    const delta = jenis === 'koreksi' ? (parseQty(stokSebenarnya) - (p.stok || 0)) : -(qty * satuan.isi);
    const after = (p.stok || 0) + delta;
    body.replaceChildren(
      h('div', { class: 'card row-between' }, h('div', null, h('div', { class: 'li-title' }, p.nama), h('div', { class: 'li-sub' }, lapakTag(p.pemilik), stockTag(p))), ctx.query.produk ? null : button('Ganti', { variant: 'ghost', onClick: () => { p = null; render(); } })),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Alasan'), h('div', { class: 'chips wrap' }, ALASAN_KELUAR.map(([v, l]) => chip(l, jenis === v, () => { jenis = v; errs = {}; render(); }))), errs.jenis ? h('div', { class: 'field-error', role: 'alert' }, errs.jenis) : null),
      jenis === 'koreksi'
        ? field(`Jumlah sebenarnya (hasil hitung, dalam ${p.satuanDasar})`, h('input', { class: 'input input-num', inputmode: 'decimal', value: stokSebenarnya, placeholder: angka(p.stok || 0), autofocus: true, onInput: (e) => { stokSebenarnya = e.target.value; preview(); } }), { help: `Tercatat sekarang: ${teksStok(p)}`, error: errs.qty })
        : h('div', { class: 'stack' },
          p.satuan.length > 1 ? h('div', { class: 'chips' }, p.satuan.map((u) => chip(u.nama, satuan.id === u.id, () => { satuan = u; render(); }))) : null,
          field(`Jumlah keluar (${satuan.nama})`, qtyControl(qty, (v) => { qty = v; preview(); }, { min: 1 }))),
      field('Catatan', h('input', { class: 'input', value: catatan, placeholder: jenis === 'pakai_sendiri' ? 'mis. untuk masak di rumah' : 'Boleh kosong', onInput: (e) => (catatan = e.target.value) }), { optional: true }),
      previewEl);
    preview();
  }
  const previewEl = h('div');
  function preview() {
    if (!p) return;
    const delta = jenis === 'koreksi' ? (stokSebenarnya === '' ? 0 : parseQty(stokSebenarnya) - (p.stok || 0)) : -(qty * (satuan?.isi || 1));
    previewEl.replaceChildren(h('div', { class: 'card stack', style: { gap: '4px' } },
      h('span', { class: 'stat-label' }, 'Stok setelah disimpan'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'price price-sm' }, teksStok(p)), icon('chev', 'icon-sm'), h('span', { class: 'price price-md', style: { color: delta < 0 ? 'var(--color-danger)' : 'var(--color-success)' } }, teksStok({ ...p, stok: (p.stok || 0) + delta })))));
  }

  async function simpan() {
    if (!p) { toast('Pilih barang dulu', { kind: 'error' }); return; }
    if (!jenis) { errs = { jenis: 'Pilih alasan' }; render(); return; }
    if (jenis === 'koreksi' && stokSebenarnya === '') { errs = { qty: 'Isi jumlah hasil hitung' }; render(); return; }
    const label = ALASAN_KELUAR.find((a) => a[0] === jenis)[1];
    const ok = await confirmDialog({ title: `Simpan: ${label}?`, text: jenis === 'koreksi' ? `Stok ${p.nama} diubah menjadi ${angka(parseQty(stokSebenarnya))} ${p.satuanDasar}.` : `${angka(qty)} ${satuan.nama} ${p.nama} keluar dari stok.`, ok: 'Simpan' });
    if (!ok) return;
    const m = await barangKeluar({ produkId: p.id, jenis, qtyDasar: qty * satuan.isi, stokSebenarnya: parseQty(stokSebenarnya), catatan });
    toast(m ? 'Stok diperbarui' : 'Tidak ada perubahan stok');
    ctx.go(ctx.query.produk ? '/produk/' + ctx.query.produk : '/barang');
  }

  render();
  return h('div', null,
    header({ title: 'Barang keluar', sub: 'Rusak, dipakai sendiri, hitung ulang', back: ctx.query.produk ? '#/produk/' + ctx.query.produk : '#/barang' }),
    h('div', { class: 'page' }, body, h('div', { class: 'sticky-foot' }, button('Simpan', { size: 'lg', block: true, icon: 'check', onClick: simpan }))));
}
