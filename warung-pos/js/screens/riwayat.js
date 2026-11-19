// RIWAYAT TRANSAKSI — dikelompokkan per hari, saring tanggal & shift.
import { h, icon, header, chip, price, empty } from '../ui.js';
import { penjualanRentang, rentangPreset } from '../store.js';
import { tanggalPendek, hariIniKey } from '../format.js';
import { transaksiItem } from './transaksi.js';

const ui = { periode: 'hariIni', shift: null, tanggal: hariIniKey(), q: '' };

export function riwayatScreen(ctx) {
  const body = h('div', { class: 'stack', style: { gap: '20px' } });
  const dateInput = h('input', { type: 'date', class: 'input', value: ui.tanggal, max: hariIniKey(), 'aria-label': 'Pilih tanggal', onChange: (e) => { ui.tanggal = e.target.value; ui.periode = 'tanggal'; load(); } });
  const q = h('input', { type: 'search', placeholder: 'Cari no. transaksi atau barang', 'aria-label': 'Cari transaksi', value: ui.q, onInput: (e) => { ui.q = e.target.value; load(); } });
  const filters = h('div', { class: 'stack' });

  async function load() {
    const r = ui.periode === 'tanggal' ? { dari: ui.tanggal, sampai: ui.tanggal } : rentangPreset[ui.periode]();
    let list = await penjualanRentang(r.dari, r.sampai);
    if (ui.shift) list = list.filter((t) => t.shift === ui.shift);
    const s = ui.q.trim().toLowerCase();
    if (s) list = list.filter((t) => t.no.toLowerCase().includes(s) || t.items.some((i) => i.nama.toLowerCase().includes(s)));
    list.sort((a, b) => b.waktu.localeCompare(a.waktu));
    filters.replaceChildren(
      h('div', { class: 'chips' }, [['hariIni', 'Hari ini'], ['kemarin', 'Kemarin'], ['tujuhHari', '7 hari']].map(([v, l]) => chip(l, ui.periode === v, () => { ui.periode = v; load(); })), chip('Pilih tanggal', ui.periode === 'tanggal', () => { ui.periode = 'tanggal'; load(); setTimeout(() => dateInput.showPicker?.(), 30); })),
      ui.periode === 'tanggal' ? dateInput : null,
      h('div', { class: 'chips' }, [[null, 'Semua shift'], ['pagi', 'Pagi'], ['siang', 'Siang']].map(([v, l]) => chip(l, ui.shift === v, () => { ui.shift = v; load(); }))));
    const groups = new Map();
    list.forEach((t) => { if (!groups.has(t.tanggal)) groups.set(t.tanggal, []); groups.get(t.tanggal).push(t); });
    body.replaceChildren(...(list.length ? [...groups].map(([tgl, arr]) => h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, `${tanggalPendek(tgl)} · ${arr.filter((t) => t.status === 'selesai').length} transaksi`, h('span', { class: 'price', style: { font: 'var(--text-num-sm)', color: 'var(--color-text)', letterSpacing: 0, textTransform: 'none' } }, 'Rp' + arr.filter((t) => t.status === 'selesai').reduce((s, t) => s + t.total, 0).toLocaleString('id-ID'))),
      h('div', { class: 'list' }, arr.map((t) => transaksiItem(t, load)))))
      : [h('div', { class: 'card' }, empty({ ic: 'receipt', title: 'Tidak ada transaksi', text: ui.q ? 'Coba kata lain atau ubah tanggal.' : 'Belum ada transaksi di periode ini.' }))]));
  }
  load();
  return h('div', null,
    header({ title: 'Riwayat transaksi', back: '#/lainnya' }),
    h('div', { class: 'page', style: { gap: '16px' } }, h('label', { class: 'search' }, icon('search'), q), filters, body));
}
