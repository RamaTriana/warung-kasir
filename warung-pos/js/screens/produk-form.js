// TAMBAH / UBAH BARANG — form satu kolom, isian wajib diberi tanda lewat validasi, bukan bintang.
import { h, icon, iconButton, button, header, chip, segmented, field, moneyInput, toast } from '../ui.js';
import { state, simpanProduk, uid, cariBarcode, simpanSettings, DEFAULT_KATEGORI } from '../store.js';
import { parseQty, LAPAK } from '../format.js';
import { bukaScanner } from '../scanner.js';

const SATUAN_CEPAT = ['pcs', 'bungkus', 'botol', 'porsi', 'gelas', 'sachet', 'batang', 'kg', 'liter', 'butir'];

export function produkFormScreen(ctx) {
  const lama = ctx.params.id ? state.produk.get(ctx.params.id) : null;
  const prefill = JSON.parse(sessionStorage.getItem('prefill') || 'null');
  if (prefill) sessionStorage.removeItem('prefill');
  const f = lama ? JSON.parse(JSON.stringify(lama)) : {
    nama: '', pemilik: prefill?.barcode ? 'warung' : (state.device.shift === 'siang' ? 'warung' : 'nasi'), kategori: '', modeStok: prefill?.barcode ? 'hitung' : 'hitung',
    satuanDasar: 'pcs', satuan: [{ id: uid(), nama: 'pcs', isi: 1, harga: 0, barcode: prefill?.barcode || '' }], modalPerDasar: 0, stokAwal: '', stokMin: '', favorit: false, aktif: true,
  };
  let errors = {};
  const form = h('form', { class: 'page', novalidate: true, onSubmit: (e) => { e.preventDefault(); simpan(); } });

  function setDasar(nama) { f.satuanDasar = nama; f.satuan[0].nama = nama; }

  function render() {
    const kategoriList = (state.settings.kategori || DEFAULT_KATEGORI)[f.pemilik] || [];
    const namaInput = h('input', { class: 'input', value: f.nama, placeholder: 'mis. Indomie Goreng', autocomplete: 'off', onInput: (e) => (f.nama = e.target.value) });
    const kategoriInput = h('input', { class: 'input', value: kategoriList.includes(f.kategori) ? '' : f.kategori, placeholder: 'Atau ketik kategori baru', onInput: (e) => (f.kategori = e.target.value) });

    form.replaceChildren(
      prefill?.barcode && !lama ? h('div', { class: 'alert alert-info' }, icon('scan', 'icon-sm'), h('div', null, 'Barcode ', h('strong', { class: 'tnum' }, prefill.barcode), ' sudah terisi. Lengkapi nama dan harga, lalu simpan.')) : null,

      field('Nama barang', namaInput, { error: errors.nama }),
      field('Milik', segmented('pemilik', [['nasi', 'Nasi'], ['warung', 'Warung (Ibu)']], f.pemilik, (v) => { f.pemilik = v; f.kategori = ''; render(); }), { help: 'Menentukan uang penjualan barang ini masuk ke siapa.' }),

      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Kategori', h('span', { class: 'opt' }, 'boleh kosong')),
        h('div', { class: 'chips wrap' }, kategoriList.map((k) => chip(k, f.kategori === k, () => { f.kategori = f.kategori === k ? '' : k; render(); }))), kategoriInput),

      h('fieldset', { class: 'field', style: { border: 0, padding: 0, margin: 0 } },
        h('legend', { class: 'field-label', style: { marginBottom: '6px' } }, 'Cara hitung stok'),
        h('div', { class: 'stack', style: { gap: '8px' } },
          [['hitung', 'Dihitung', 'Barang kemasan. Stok berkurang tiap terjual, bertambah lewat Barang masuk.'],
           ['harian', 'Harian', 'Dibuat tiap pagi (nasi, gorengan). Isi stok pagi, sisanya dicatat saat tutup shift.'],
           ['tanpa', 'Tanpa stok', 'Dibuat saat dipesan, mis. es teh. Tidak ada hitungan stok.']].map(([v, t, d]) =>
            h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'mode', value: v, checked: f.modeStok === v, onChange: () => { f.modeStok = v; render(); } }), h('span', { class: 'choice-mark' }), h('span', null, h('span', { class: 'choice-title' }, t), h('span', { class: 'choice-desc', style: { display: 'block' } }, d)))))),

      h('section', { class: 'section', 'aria-labelledby': 'sat-h' },
        h('h2', { class: 'section-title', id: 'sat-h' }, 'Satuan & harga jual'),
        satuanRow(0),
        ...f.satuan.slice(1).map((_, i) => satuanRow(i + 1)),
        button(f.satuan.length > 1 ? 'Tambah satuan lain' : 'Tambah satuan lain (bungkus, dus)', { variant: 'ghost', icon: 'plus', onClick: () => { f.satuan.push({ id: uid(), nama: '', isi: '', harga: 0, barcode: '' }); render(); }, attrs: { style: 'align-self:flex-start' } }),
        errors.satuan ? h('div', { class: 'field-error', role: 'alert' }, errors.satuan) : null),

      f.modeStok !== 'tanpa' || true ? field(`Modal per ${f.satuanDasar || 'satuan'}`, moneyInput(f.modalPerDasar, (v) => (f.modalPerDasar = v)), { optional: true,
        help: f.modeStok === 'harian' ? 'Untuk masakan sendiri biarkan kosong, lalu catat belanja bahan di Pengeluaran. Jangan diisi dua-duanya.' : 'Dipakai untuk menghitung laba. Otomatis diperbarui dari Barang masuk.' }) : null,

      f.modeStok === 'hitung' ? h('div', { class: 'row', style: { alignItems: 'flex-start' } },
        !lama ? h('div', { class: 'grow' }, field(`Stok awal (${f.satuanDasar || 'satuan'})`, h('input', { class: 'input input-num', inputmode: 'decimal', value: f.stokAwal, placeholder: '0', onInput: (e) => (f.stokAwal = e.target.value) }), { optional: true })) : null,
        h('div', { class: 'grow' }, field('Ingatkan kalau sisa', h('input', { class: 'input input-num', inputmode: 'decimal', value: f.stokMin || '', placeholder: '0', onInput: (e) => (f.stokMin = e.target.value) }), { optional: true }))) : null,

      h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: f.favorit, onChange: (e) => (f.favorit = e.target.checked) }), h('span', null, 'Tampilkan di ', h('strong', null, 'Favorit'), ' kasir')),

      h('div', { class: 'sticky-foot' }, button(lama ? 'Simpan perubahan' : 'Simpan barang', { type: 'submit', size: 'lg', block: true })));
  }

  function satuanRow(i) {
    const u = f.satuan[i];
    const base = i === 0;
    const err = errors['s' + i] || {};
    const scanBtn = iconButton('scan', 'Scan barcode', async () => {
      await bukaScanner({ judul: 'Scan barcode barang', lanjut: false, onCode: (code) => { u.barcode = code; render(); return { ok: true, label: code }; } });
    }, { class: 'icon-btn suffix-btn' });
    return h('div', { class: 'card stack', style: { gap: '12px', padding: '12px' } },
      h('div', { class: 'row-between' }, h('strong', null, base ? 'Satuan terkecil' : `Satuan lain ${i}`), base ? null : iconButton('trash', 'Hapus satuan ini', () => { f.satuan.splice(i, 1); render(); })),
      base ? h('div', { class: 'stack', style: { gap: '6px' } },
        h('div', { class: 'chips' }, SATUAN_CEPAT.map((s) => chip(s, u.nama === s, () => { setDasar(s); render(); }))),
        field('Nama satuan', h('input', { class: 'input', value: u.nama, placeholder: 'pcs', onInput: (e) => setDasar(e.target.value) }), { error: err.nama }))
        : h('div', { class: 'row', style: { alignItems: 'flex-start' } },
          h('div', { class: 'grow' }, field('Nama', h('input', { class: 'input', value: u.nama, placeholder: 'bungkus', onInput: (e) => (u.nama = e.target.value) }), { error: err.nama })),
          h('div', { style: { width: '42%' } }, field(`Isi (${f.satuanDasar || 'pcs'})`, h('input', { class: 'input input-num', inputmode: 'decimal', value: u.isi ? String(u.isi).replace('.', ',') : '', placeholder: '16', onInput: (e) => (u.isi = parseQty(e.target.value)) }), { error: err.isi }))),
      field(base ? `Harga per ${u.nama || 'satuan'}` : 'Harga', moneyInput(u.harga, (v) => (u.harga = v)), { error: err.harga }),
      field('Barcode', h('div', { class: 'input-group' }, h('input', { class: 'input tnum', style: { paddingLeft: '12px', paddingRight: '52px' }, inputmode: 'numeric', value: u.barcode, placeholder: 'Scan atau ketik', onInput: (e) => (u.barcode = e.target.value.trim()) }), scanBtn), { optional: true, error: err.barcode }));
  }

  function validasi() {
    errors = {};
    if (!f.nama.trim()) errors.nama = 'Nama barang wajib diisi';
    f.satuan.forEach((u, i) => {
      const e = {};
      if (!String(u.nama || '').trim()) e.nama = 'Isi nama satuan';
      if (!u.harga || u.harga <= 0) e.harga = 'Harga wajib diisi';
      if (i > 0 && (!u.isi || u.isi <= 0)) e.isi = 'Isi harus lebih dari 0';
      if (i > 0 && u.isi === 1) e.isi = 'Isi 1 sama dengan satuan terkecil';
      if (u.barcode) {
        const dup = cariBarcode(u.barcode);
        if (dup && dup.produk.id !== f.id) e.barcode = `Sudah dipakai ${dup.produk.nama}`;
        if (f.satuan.filter((x) => x.barcode === u.barcode).length > 1) e.barcode = 'Barcode dipakai dua kali';
      }
      if (Object.keys(e).length) errors['s' + i] = e;
    });
    return !Object.keys(errors).length;
  }

  async function simpan() {
    if (!validasi()) { render(); toast('Ada isian yang perlu diperbaiki', { kind: 'error' }); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const kat = (f.kategori || '').trim();
    const list = state.settings.kategori?.[f.pemilik] || [];
    if (kat && !list.includes(kat)) await simpanSettings({ ...state.settings, kategori: { ...state.settings.kategori, [f.pemilik]: [...list, kat] } });
    const p = await simpanProduk({ ...f, kategori: kat, stokAwal: parseQty(f.stokAwal), stokMin: parseQty(f.stokMin) });
    toast(lama ? 'Perubahan disimpan' : `${p.nama} disimpan`);
    if (prefill?.dariKasir) { sessionStorage.setItem('tambahKeKeranjang', p.id); ctx.go('/kasir'); }
    else ctx.go('/produk/' + p.id);
  }

  render();
  return h('div', null,
    header({ title: lama ? 'Ubah barang' : 'Tambah barang', sub: lama ? lama.nama : null, back: lama ? '#/produk/' + lama.id : (prefill?.dariKasir ? '#/kasir' : '#/barang') }),
    form);
}
