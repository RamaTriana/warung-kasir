// PENGELUARAN — biaya operasional. Belanja barang dagangan sengaja diarahkan ke Barang masuk
// supaya laba tidak dihitung dua kali (SRS bagian 8 logika 5).
import { h, icon, button, header, chip, segmented, field, moneyInput, price, lapakTag, toast, sheet, empty, confirmDialog, alertBox } from '../ui.js';
import { state, catatPengeluaran, batalPengeluaran, KATEGORI_PENGELUARAN, laporan, rentangPreset } from '../store.js';
import { jam, tanggalPendek, rupiah } from '../format.js';

const ui = { periode: 'hariIni' };

export function pengeluaranScreen(ctx) {
  const body = h('div', { class: 'stack' });
  async function load() {
    const r = await laporan(rentangPreset[ui.periode]());
    body.replaceChildren(
      h('div', { class: 'chips' }, [['hariIni', 'Hari ini'], ['tujuhHari', '7 hari'], ['bulanIni', 'Bulan ini']].map(([v, l]) => chip(l, ui.periode === v, () => { ui.periode = v; load(); }))),
      h('div', { class: 'stat-hero' }, h('span', { class: 'stat-label' }, 'Total pengeluaran'), price(r.pengeluaran, 'lg')),
      r.pengeluaranList.length ? h('div', { class: 'list' }, r.pengeluaranList.map((p) => h('button', { type: 'button', class: 'list-item', onClick: () => detail(p) },
        h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, p.kategori + (p.catatan ? ` · ${p.catatan}` : '')), h('span', { class: 'li-sub' }, lapakTag(p.pemilik), h('span', { class: 'tnum' }, `${tanggalPendek(p.tanggal)} ${jam(p.waktu)}`), p.dariLaci ? 'dari laci' : 'uang lain')),
        price(p.nominal, 'sm'))))
        : h('div', { class: 'card' }, empty({ ic: 'wallet', title: 'Belum ada pengeluaran', text: 'Catat gas, listrik, bahan baku, dan biaya lain di sini.' })));
  }
  function detail(p) {
    const s = sheet({ title: p.kategori, body: h('dl', { class: 'stack', style: { gap: 0 } },
      h('div', { class: 'kv' }, h('dt', null, 'Nominal'), h('dd', null, price(p.nominal, 'md'))),
      h('div', { class: 'kv' }, h('dt', null, 'Milik'), h('dd', null, lapakTag(p.pemilik))),
      h('div', { class: 'kv' }, h('dt', null, 'Waktu'), h('dd', null, `${tanggalPendek(p.tanggal)} ${jam(p.waktu)}`)),
      h('div', { class: 'kv' }, h('dt', null, 'Dibayar'), h('dd', null, p.dariLaci ? 'Dari laci' : 'Uang lain')),
      h('div', { class: 'kv' }, h('dt', null, 'Dicatat oleh'), h('dd', null, p.oleh || '-')),
      p.catatan ? h('div', { class: 'kv' }, h('dt', null, 'Catatan'), h('dd', null, p.catatan)) : null),
      foot: button('Batalkan pengeluaran ini', { variant: 'danger', block: true, onClick: async () => {
        if (await confirmDialog({ title: 'Batalkan pengeluaran?', text: 'Catatan tetap disimpan dengan status batal.', ok: 'Batalkan', danger: true })) { await batalPengeluaran(p.id); s.close(); toast('Pengeluaran dibatalkan'); load(); }
      } }) });
  }
  load();
  return h('div', null,
    header({ title: 'Pengeluaran', back: '#/lainnya', actions: [button('Catat', { variant: 'ghost', icon: 'plus', onClick: () => ctx.go('/pengeluaran/baru') })] }),
    h('div', { class: 'page' }, body));
}

export function pengeluaranFormScreen(ctx) {
  let kategori = null, nominal = 0, pemilik = state.device.shift === 'siang' ? 'warung' : null, dariLaci = true, catatan = '';
  let errs = {};
  const form = h('form', { class: 'page', novalidate: true, onSubmit: (e) => { e.preventDefault(); simpan(); } });
  const nominalField = h('div');

  function render() {
    form.replaceChildren(
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Untuk apa?'),
        h('div', { class: 'chips wrap' }, KATEGORI_PENGELUARAN.map((k) => chip(k, kategori === k, () => { kategori = k; if (k === 'Bahan baku' && !pemilik) pemilik = 'nasi'; errs.kategori = null; render(); })),
          chip('Belanja barang dagangan', kategori === 'stok', () => { kategori = 'stok'; render(); })),
        errs.kategori ? h('div', { class: 'field-error', role: 'alert' }, errs.kategori) : null),
      kategori === 'stok' ? alertBox('info', 'info', h('div', { class: 'stack', style: { gap: '8px' } },
        h('p', null, 'Belanja barang yang dijual lagi dicatat di ', h('strong', null, 'Barang masuk'), ', bukan di pengeluaran. Dengan begitu stok bertambah dan laba tidak terhitung dua kali.'),
        button('Buka Barang masuk', { icon: 'in', onClick: () => ctx.go('/masuk') }))) : h('div', { class: 'stack', style: { gap: '20px' } },
        field('Nominal', moneyInput(nominal, (v) => { nominal = v; }, { autofocus: true }), { error: errs.nominal }),
        field('Biaya milik', segmented('pemilik-p', [['nasi', 'Nasi'], ['warung', 'Warung (Ibu)']], pemilik, (v) => { pemilik = v; errs.pemilik = null; }), { error: errs.pemilik, help: 'Mengurangi laba lapak yang dipilih.' }),
        h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: dariLaci, onChange: (e) => (dariLaci = e.target.checked) }), h('span', null, 'Dibayar pakai uang laci')),
        field('Catatan', h('input', { class: 'input', value: catatan, placeholder: 'mis. tabung gas 3 kg', onInput: (e) => (catatan = e.target.value) }), { optional: true }),
        h('div', { class: 'sticky-foot' }, button('Simpan pengeluaran', { type: 'submit', size: 'lg', block: true }))));
  }
  async function simpan() {
    errs = {};
    if (!kategori || kategori === 'stok') errs.kategori = 'Pilih kategori';
    if (!nominal) errs.nominal = 'Nominal wajib diisi';
    if (!pemilik) errs.pemilik = 'Pilih Nasi atau Warung';
    if (Object.keys(errs).length) { render(); return; }
    await catatPengeluaran({ kategori, nominal, pemilik, dariLaci, catatan });
    toast(`Pengeluaran ${rupiah(nominal)} dicatat`);
    ctx.go('/pengeluaran');
  }
  render();
  return h('div', null, header({ title: 'Catat pengeluaran', back: '#/pengeluaran' }), form);
}
