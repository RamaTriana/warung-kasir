// SETUP — sekali per HP. Tiga langkah: siapa & shift → sambungan Google (boleh nanti) → data awal.
import { h, icon, button, field, toast } from '../ui.js';
import { state, simpanDevice, simpanSettings, uid, init, DEFAULT_KATEGORI } from '../store.js';
import * as sync from '../sync.js';

export function setupScreen(ctx) {
  const f = { namaWarung: state.settings?.namaWarung && state.settings.namaWarung !== 'Warung' ? state.settings.namaWarung : '', nama: '', shift: null, url: '', kode: '', data: 'kosong' };
  let step = 1, err = {};
  const wrap = h('div', { class: 'page', style: { paddingTop: '32px', gap: '24px' } });

  const choice = (name, value, title, desc, checked, onChange) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name, value, checked, onChange }), h('span', { class: 'choice-mark' }),
    h('span', null, h('span', { class: 'choice-title' }, title), h('span', { class: 'choice-desc', style: { display: 'block' } }, desc)));

  function render() {
    const steps = h('p', { class: 'section-title' }, `Langkah ${step} dari 3`);
    if (step === 1) wrap.replaceChildren(
      h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'brand', 'aria-hidden': 'true' }, h('span', null, 'W')), steps, h('h1', { style: { font: 'var(--text-title)', fontSize: '1.75rem' } }, 'Siapkan HP ini untuk berjualan'), h('p', { class: 'secondary' }, 'Cukup sekali. Setelah ini aplikasi langsung membuka kasir.')),
      field('Nama warung', h('input', { class: 'input', value: f.namaWarung, placeholder: 'mis. Warung Bu Darmi', onInput: (e) => (f.namaWarung = e.target.value) }), { optional: true }),
      field('Nama penjaga yang memakai HP ini', h('input', { class: 'input', value: f.nama, placeholder: 'mis. Bu Sri', autocomplete: 'off', onInput: (e) => (f.nama = e.target.value) }), { error: err.nama }),
      h('fieldset', { class: 'field', style: { border: 0, margin: 0, padding: 0 } }, h('legend', { class: 'field-label', style: { marginBottom: '6px' } }, 'HP ini dipakai untuk'),
        h('div', { class: 'stack', style: { gap: '8px' } },
          choice('shift', 'pagi', 'Shift pagi', 'Menjual nasi dan jajanan, sekaligus menjaga barang warung. Saat tutup shift, uang warung diserahkan ke Ibu.', f.shift === 'pagi', () => (f.shift = 'pagi')),
          choice('shift', 'siang', 'Shift siang', 'Menjaga warung kelontong.', f.shift === 'siang', () => (f.shift = 'siang'))),
        err.shift ? h('div', { class: 'field-error', role: 'alert' }, err.shift) : null),
      h('div', { class: 'sticky-foot' }, button('Lanjut', { size: 'lg', block: true, onClick: () => {
        err = {}; if (!f.nama.trim()) err.nama = 'Isi nama penjaga'; if (!f.shift) err.shift = 'Pilih salah satu';
        if (Object.keys(err).length) { render(); return; } step = 2; render();
      } })));
    if (step === 2) wrap.replaceChildren(
      h('div', { class: 'stack', style: { gap: '8px' } }, steps, h('h1', { style: { font: 'var(--text-title)' } }, 'Salinan ke Google Sheets'), h('p', { class: 'secondary' }, 'Supaya data tidak hilang kalau HP rusak, dan supaya kedua HP bisa saling melihat stok warung. Bisa diisi nanti di Lainnya → Salinan ke Google.')),
      field('Alamat Apps Script', h('input', { class: 'input', value: f.url, inputmode: 'url', placeholder: 'https://script.google.com/…/exec', onInput: (e) => (f.url = e.target.value.trim()) }), { optional: true }),
      field('Kode rahasia', h('input', { class: 'input tnum', value: f.kode, placeholder: '8 huruf/angka', onInput: (e) => (f.kode = e.target.value.trim().toUpperCase()) }), { optional: true }),
      h('div', { class: 'sticky-foot' }, button('Kembali', { variant: 'secondary', onClick: () => { step = 1; render(); } }), button(f.url ? 'Lanjut' : 'Lewati, nanti saja', { size: 'lg', attrs: { style: 'flex:1' }, onClick: () => { step = 3; render(); } })));
    if (step === 3) wrap.replaceChildren(
      h('div', { class: 'stack', style: { gap: '8px' } }, steps, h('h1', { style: { font: 'var(--text-title)' } }, 'Mulai dengan data apa?')),
      h('div', { class: 'stack', style: { gap: '8px' } },
        f.url && f.kode ? choice('data', 'pulihkan', 'Ambil dari Google Sheets', 'Untuk HP kedua atau HP pengganti. Barang dan stok warung ikut terambil.', f.data === 'pulihkan', () => (f.data = 'pulihkan')) : null,
        choice('data', 'kosong', 'Mulai kosong', 'Barang ditambahkan sendiri, atau didaftarkan saat di-scan.', f.data === 'kosong', () => (f.data = 'kosong')),
        choice('data', 'contoh', 'Pakai data contoh', 'Untuk mencoba dulu: 23 barang dan riwayat 2 minggu. Bisa dihapus nanti di Pengaturan.', f.data === 'contoh', () => (f.data = 'contoh'))),
      h('div', { class: 'sticky-foot' }, button('Kembali', { variant: 'secondary', onClick: () => { step = 2; render(); } }), button('Mulai berjualan', { size: 'lg', attrs: { style: 'flex:1' }, onClick: selesai })));
  }

  async function selesai(e) {
    const b = e.currentTarget; b.classList.add('is-loading');
    try {
      await simpanSettings({ namaWarung: f.namaWarung.trim() || 'Warung', kategori: DEFAULT_KATEGORI });
      await simpanDevice({ id: uid(), nama: f.nama.trim(), shift: f.shift, dibuat: new Date().toISOString() });
      if (f.url && f.kode) await sync.simpanKonfigurasi({ url: f.url, kode: f.kode });
      if (f.data === 'contoh') { const { isiDataContoh } = await import('../seed.js'); await isiDataContoh(); }
      if (f.data === 'pulihkan') { const n = await sync.pulihkan({ url: f.url, kode: f.kode }); toast(`${n} catatan diambil dari Google`); }
      await init();
      ctx.go('/kasir');
    } catch (err) { b.classList.remove('is-loading'); toast('Gagal: ' + err.message, { kind: 'error' }); }
  }
  render();
  return wrap;
}
