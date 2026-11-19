// Komponen bersama: baris transaksi + sheet detail transaksi (dipakai Hari Ini & Riwayat).
import { h, icon, price, lapakTag, sheet, button, confirmDialog, toast } from '../ui.js';
import { batalkan, state } from '../store.js';
import { jam, tanggalPendek, rupiah, SHIFT } from '../format.js';

export function transaksiItem(rec, onChanged, { tampilTanggal = false } = {}) {
  const batal = rec.status === 'batal';
  return h('button', { type: 'button', class: ['list-item', batal && 'voided'], onClick: () => detailTransaksi(rec, onChanged),
    'aria-label': `Transaksi ${rec.no}, ${rupiah(rec.total)}${batal ? ', dibatalkan' : ''}` },
    h('div', { class: 'li-main' },
      h('span', { class: 'li-title' }, rec.items.map((i) => i.nama).join(', ')),
      h('span', { class: 'li-sub' }, h('span', { class: 'tnum' }, (tampilTanggal ? tanggalPendek(rec.tanggal) + ' · ' : '') + jam(rec.waktu)), h('span', { class: ['shift-pill', rec.shift], style: { padding: '0 6px', background: 'none' } }, SHIFT[rec.shift]), h('span', { class: 'muted' }, rec.no))),
    h('div', { class: 'li-end' }, price(rec.total, 'sm'), batal ? h('span', { class: 'badge badge-danger' }, 'Batal') : null));
}

export function detailTransaksi(rec, onChanged) {
  const batal = rec.status === 'batal';
  const bisaBatal = !batal && (rec.deviceId === state.device.id);
  const s = sheet({ title: `Transaksi ${rec.no}`, body: h('div', { class: 'stack', style: { gap: '12px' } },
    h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } },
      h('span', { class: ['shift-pill', rec.shift] }, 'Shift ' + SHIFT[rec.shift].toLowerCase()),
      h('span', { class: 'secondary' }, `${tanggalPendek(rec.tanggal)}, ${jam(rec.waktu)} · ${rec.penjaga}`),
      batal ? h('span', { class: 'badge badge-danger' }, 'Dibatalkan') : h('span', { class: 'badge badge-success' }, 'Selesai')),
    batal ? h('div', { class: 'alert alert-danger' }, icon('alert', 'icon-sm'), h('div', null, h('strong', null, 'Alasan batal: '), rec.alasanBatal || '-', rec.dibatalkanOleh ? ` (${rec.dibatalkanOleh}, ${jam(rec.waktuBatal)})` : '')) : null,
    h('div', null, rec.items.map((it) => h('div', { class: 'cart-item' },
      h('div', null, h('div', { class: 'ci-name' }, it.nama), h('div', { class: 'ci-meta' }, lapakTag(it.pemilik), `${String(it.qty).replace('.', ',')} ${it.satuan} × ${rupiah(it.harga)}`, it.manual ? h('span', { class: 'badge' }, 'barang lain') : null)),
      price(it.subtotal, 'sm')))),
    h('hr', { class: 'rule' }),
    h('dl', { class: 'stack', style: { gap: 0 } },
      h('div', { class: 'kv' }, h('dt', null, 'Total'), h('dd', null, price(rec.total, 'md'))),
      h('div', { class: 'kv' }, h('dt', null, 'Dibayar'), h('dd', null, price(rec.dibayar, 'sm'))),
      h('div', { class: 'kv' }, h('dt', null, 'Kembalian'), h('dd', null, price(rec.kembalian, 'sm'))))),
    foot: bisaBatal ? button('Batalkan transaksi', { variant: 'danger', block: true, icon: 'trash', onClick: async () => {
      const alasan = await confirmDialog({ title: 'Batalkan transaksi?', text: 'Stok barang dikembalikan. Transaksi tetap tercatat dengan status batal.', ok: 'Batalkan', danger: true, input: { placeholder: 'Alasan', required: true, chips: ['Salah tekan', 'Pembeli batal', 'Salah harga'] } });
      if (alasan) { await batalkan(rec.id, alasan); s.close(); toast('Transaksi dibatalkan'); onChanged && onChanged(); }
    } }) : (!batal ? h('p', { class: 'field-help' }, 'Transaksi dari HP lain hanya bisa dibatalkan di HP yang mencatatnya.') : null) });
}
