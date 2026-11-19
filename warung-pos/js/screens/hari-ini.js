// HARI INI — ringkasan untuk penjaga: uang masuk per lapak, shift, stok menipis, transaksi hari ini.
import { h, icon, button, header, price, lapakTag, stockTag, empty } from '../ui.js';
import { state, laporan, rentangPreset, stokMenipis, penjualanRentang } from '../store.js';
import { salam, jam, tanggalPanjang, hariIniKey, SHIFT } from '../format.js';
import { transaksiItem } from './transaksi.js';

export function hariIniScreen(ctx) {
  const shift = state.device.shift;
  const body = h('div', { class: 'page' }, skeleton());

  async function load() {
    const r = await laporan(rentangPreset.hariIni());
    const trx = (await penjualanRentang(hariIniKey(), hariIniKey())).sort((a, b) => b.waktu.localeCompare(a.waktu));
    const low = stokMenipis();
    const sesi = state.sesi;

    body.replaceChildren(
      h('div', { class: 'stack', style: { gap: '4px' } },
        h('h1', { style: { font: 'var(--text-title)' } }, `${salam()}, ${state.device.nama}`),
        h('p', { class: 'secondary' }, sesi ? `Shift ${SHIFT[sesi.shift].toLowerCase()} berjalan sejak ${jam(sesi.dibuka)}` : 'Shift belum dimulai. Buka Kasir untuk mulai.')),

      h('section', { class: 'section', 'aria-labelledby': 'hd-omzet' },
        h('div', { class: 'stat-hero' }, h('span', { class: 'stat-label', id: 'hd-omzet' }, 'Penjualan hari ini'), price(r.omzet, 'display'),
          h('span', { class: 'stat-note' }, `${r.transaksi} transaksi${r.batal ? ` · ${r.batal} dibatalkan` : ''}`)),
        h('div', { class: 'stat-grid' },
          h('div', null, lapakTag('nasi'), price(r.perPemilik.nasi, 'md')),
          h('div', null, lapakTag('warung'), price(r.perPemilik.warung, 'md')),
          h('div', null, h('span', { class: 'stat-label' }, 'Pengeluaran'), price(r.pengeluaran, 'md')),
          h('div', null, h('span', { class: 'stat-label' }, 'Estimasi laba'), price(r.laba, 'md'), h('span', { class: 'stat-note' }, 'omzet − modal − biaya')))),

      h('div', { class: 'row', style: { gap: '8px' } },
        sesi ? button('Tutup shift', { variant: 'secondary', icon: 'lock', onClick: () => ctx.go('/tutup'), attrs: { style: 'flex:1' } }) : button('Mulai shift', { variant: 'secondary', icon: 'kasir', onClick: () => ctx.go('/kasir'), attrs: { style: 'flex:1' } }),
        button('Pengeluaran', { variant: 'secondary', icon: 'wallet', onClick: () => ctx.go('/pengeluaran/baru'), attrs: { style: 'flex:1' } })),

      h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, 'Per shift'),
        h('div', { class: 'list' },
          ['pagi', 'siang'].map((s) => h('div', { class: 'list-item', style: { minHeight: '56px' } },
            h('div', { class: 'li-main' }, h('span', { class: ['shift-pill', s], style: { alignSelf: 'flex-start' } }, 'Shift ' + SHIFT[s].toLowerCase())),
            price(r.perShift[s], 'sm'))))),

      low.length ? h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, `Stok menipis (${low.length})`, h('a', { href: '#/barang?filter=menipis' }, 'Lihat semua')),
        h('div', { class: 'list' }, low.slice(0, 5).map((p) => h('a', { class: 'list-item', href: '#/produk/' + p.id, style: { minHeight: '56px' } },
          h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, p.nama), h('span', { class: 'li-sub' }, lapakTag(p.pemilik))), stockTag(p))))) : null,

      h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, 'Transaksi hari ini', trx.length > 8 ? h('a', { href: '#/riwayat' }, 'Semua') : null),
        trx.length ? h('div', { class: 'list' }, trx.slice(0, 8).map((t) => transaksiItem(t, load)))
          : h('div', { class: 'card' }, empty({ ic: 'receipt', title: 'Belum ada transaksi', text: 'Transaksi dari kedua HP muncul di sini.', action: button('Buka kasir', { onClick: () => ctx.go('/kasir') }) }))),
    );
  }
  load();

  return h('div', null,
    header({ title: 'Hari Ini', sub: tanggalPanjang(hariIniKey()), shift, actions: [ctx.syncBadge()] }),
    body);
}

export function skeleton() {
  return h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Memuat' },
    h('div', { class: 'skeleton', style: { height: '28px', width: '60%' } }),
    h('div', { class: 'skeleton', style: { height: '48px', width: '75%' } }),
    h('div', { class: 'skeleton', style: { height: '132px' } }),
    h('div', { class: 'skeleton', style: { height: '112px' } }));
}
