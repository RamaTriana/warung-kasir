// LAPORAN — angka dulu, visual seperlunya (bar sederhana untuk perbandingan per hari & terlaris).
import { h, icon, button, header, chip, segmented, price, lapakTag, empty, toast } from '../ui.js';
import { laporan, rentangPreset, penjualanRentang } from '../store.js';
import { tanggalPendek, rupiah, angka, LAPAK, SHIFT, geserHari } from '../format.js';
import { skeleton } from './hari-ini.js';

const ui = { periode: 'tujuhHari', pemilik: null, shift: null };
const LABEL_PERIODE = { hariIni: 'Hari ini', tujuhHari: '7 hari', bulanIni: 'Bulan ini', bulanLalu: 'Bulan lalu' };

export function laporanScreen(ctx) {
  const body = h('div', { class: 'stack', style: { gap: '24px' } }, skeleton());
  const filters = h('div', { class: 'stack' });

  async function load() {
    filters.replaceChildren(
      h('div', { class: 'chips' }, Object.entries(LABEL_PERIODE).map(([v, l]) => chip(l, ui.periode === v, () => { ui.periode = v; load(); }))),
      segmented('lap-pemilik', [['', 'Semua'], ['nasi', 'Nasi'], ['warung', 'Warung']], ui.pemilik || '', (v) => { ui.pemilik = v || null; load(); }),
      h('div', { class: 'chips' }, [[null, 'Semua shift'], ['pagi', 'Shift pagi'], ['siang', 'Shift siang']].map(([v, l]) => chip(l, ui.shift === v, () => { ui.shift = v; load(); }))));
    const range = rentangPreset[ui.periode]();
    const r = await laporan({ ...range, pemilik: ui.pemilik, shift: ui.shift });
    const hari = [];
    for (let d = range.sampai; d >= range.dari; d = geserHari(d, -1)) hari.push(d);
    const maxHari = Math.max(1, ...hari.map((d) => r.perHari.get(d) || 0));
    const top = r.terlarisList.slice(0, 10);
    const maxTop = Math.max(1, ...top.map((t) => t.omzet));

    body.replaceChildren(
      h('section', { class: 'section' },
        h('div', { class: 'stat-hero' }, h('span', { class: 'stat-label' }, `Penjualan · ${LABEL_PERIODE[ui.periode].toLowerCase()}${ui.pemilik ? ' · ' + LAPAK[ui.pemilik] : ''}`), price(r.omzet, 'display'), h('span', { class: 'stat-note' }, `${r.transaksi} transaksi${r.batal ? ` · ${r.batal} batal (tidak dihitung)` : ''}`)),
        h('div', { class: 'stat-grid' },
          h('div', null, h('span', { class: 'stat-label' }, 'Modal barang terjual'), price(r.modal, 'md')),
          h('div', null, h('span', { class: 'stat-label' }, 'Pengeluaran'), price(r.pengeluaran, 'md')),
          h('div', { style: { gridColumn: '1 / -1', borderRight: 0 } }, h('span', { class: 'stat-label' }, 'Estimasi laba'), price(r.laba, 'lg'), h('span', { class: 'stat-note' }, 'penjualan − modal barang terjual − pengeluaran'))),
        r.adaModalKosong ? h('div', { class: 'alert alert-warning' }, icon('alert', 'icon-sm'), h('div', null, 'Sebagian barang warung belum punya harga modal, jadi laba terlihat lebih besar dari kenyataan. Isi modal lewat ', h('a', { class: 'link', href: '#/masuk' }, 'Barang masuk'), '.')) : null,
        h('details', { class: 'card' }, h('summary', { style: { cursor: 'pointer', font: 'var(--text-body-strong)', minHeight: '32px' } }, 'Beda penjualan, laba, dan uang kas'),
          h('div', { class: 'stack', style: { marginTop: '8px', gap: '8px' } },
            h('p', null, h('strong', null, 'Penjualan (omzet)'), ' = semua uang dari pembeli.'),
            h('p', null, h('strong', null, 'Laba'), ' = penjualan dikurangi modal barang yang terjual dan biaya. Ini uang yang benar-benar untung.'),
            h('p', null, h('strong', null, 'Uang kas'), ' = uang fisik di laci. Belanja stok mengurangi kas hari itu, tapi baru mengurangi laba saat barangnya terjual.')))),

      !r.transaksi ? h('div', { class: 'card' }, empty({ ic: 'chart', title: 'Belum ada penjualan', text: 'Belum ada transaksi di periode dan saringan ini.' })) : h('div', { class: 'stack', style: { gap: '24px' } },
        !ui.shift ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Per shift'),
          h('div', { class: 'stat-grid' }, ['pagi', 'siang'].map((s) => h('div', null, h('span', { class: ['shift-pill', s], style: { alignSelf: 'flex-start' } }, SHIFT[s]), price(r.perShift[s], 'md'))))) : null,
        !ui.pemilik ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Per lapak'),
          h('div', { class: 'stat-grid' }, ['nasi', 'warung'].map((p) => h('div', null, lapakTag(p), price(r.perPemilik[p], 'md'))))) : null,
        hari.length > 1 ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Per hari'),
          h('div', { class: 'card', style: { padding: '8px 16px' } }, hari.map((d) => { const v = r.perHari.get(d) || 0; return h('div', { class: 'bar-row' },
            h('span', null, tanggalPendek(d)), price(v, 'sm'), h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: { width: (v / maxHari * 100) + '%' } }))); }))) : null,
        h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Paling laku (menurut uang masuk)'),
          h('div', { class: 'card', style: { padding: '8px 16px' } }, top.map((t, i) => h('div', { class: 'bar-row' },
            h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, h('span', { class: 'muted tnum' }, `${i + 1}. `), t.nama, h('span', { class: 'muted' }, ` · ${angka(t.qty)} ${t.satuan}`)),
            price(t.omzet, 'sm'), h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { class: t.pemilik, style: { width: (t.omzet / maxTop * 100) + '%' } }))))))),

      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Unduh'),
        button('Unduh data penjualan (Excel/CSV)', { variant: 'secondary', icon: 'download', block: true, onClick: () => unduhCSV(range) }),
        h('p', { class: 'field-help' }, 'Laporan lengkap kedua HP juga ada di Google Sheets keluarga (File → Download → Microsoft Excel).')));
  }
  load();
  return h('div', null, header({ title: 'Laporan', back: '#/lainnya' }), h('div', { class: 'page', style: { gap: '16px' } }, filters, body));
}

// CSV dengan pemisah titik koma + BOM: terbuka rapi di Excel berbahasa Indonesia dan Google Sheets
async function unduhCSV({ dari, sampai }) {
  const list = (await penjualanRentang(dari, sampai)).sort((a, b) => a.waktu.localeCompare(b.waktu));
  const rows = [['Tanggal', 'Jam', 'No', 'Shift', 'Penjaga', 'Lapak', 'Barang', 'Satuan', 'Jumlah', 'Harga', 'Subtotal', 'Modal', 'Status']];
  list.forEach((t) => t.items.forEach((i) => rows.push([t.tanggal, new Date(t.waktu).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }), t.no, t.shift, t.penjaga, i.pemilik, i.nama, i.satuan, String(i.qty).replace('.', ','), i.harga, i.subtotal, i.modal * i.qty, t.status])));
  const csv = '﻿' + rows.map((r) => r.map((c) => { const s = String(c ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `penjualan_${dari}_${sampai}.csv` });
  document.body.append(a); a.click(); a.remove();
  toast(`${rows.length - 1} baris diunduh`);
}
