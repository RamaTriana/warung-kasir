// BARANG — daftar produk & stok, detail produk dengan riwayat stok.
import { h, icon, button, header, chip, price, lapakTag, stockTag, empty, confirmDialog, toast, iconButton } from '../ui.js';
import { state, daftarProduk, riwayatStok, setAktif, barangKeluar } from '../store.js';
import { statusStok, teksStok, angka, jam, tanggalPendek, rupiah, LAPAK } from '../format.js';

const ui = { q: '', filter: 'semua' };

export function barangScreen(ctx) {
  if (ctx.query.filter) ui.filter = ctx.query.filter;
  const listEl = h('div');
  const chipsEl = h('div', { class: 'chips', role: 'toolbar', 'aria-label': 'Saring barang' });
  const input = h('input', { type: 'search', placeholder: 'Cari nama atau barcode…', 'aria-label': 'Cari barang', value: ui.q, autocomplete: 'off' });

  function render() {
    const aktif = daftarProduk();
    const nonaktif = daftarProduk({ aktif: false });
    const counts = { menipis: aktif.filter((p) => statusStok(p) === 'low').length, habis: aktif.filter((p) => statusStok(p) === 'out').length };
    const opts = [['semua', 'Semua', aktif.length], ['menipis', 'Menipis', counts.menipis], ['habis', 'Habis', counts.habis], ['nasi', 'Nasi'], ['warung', 'Warung'], ['nonaktif', 'Disembunyikan', nonaktif.length]];
    chipsEl.replaceChildren(...opts.filter((o) => o[0] !== 'nonaktif' || o[2]).map(([v, l, n]) => chip(l, ui.filter === v, () => { ui.filter = v; render(); }, n != null ? h('span', { class: 'count' }, n) : null)));
    let arr = ui.filter === 'nonaktif' ? nonaktif : aktif;
    if (ui.filter === 'menipis') arr = arr.filter((p) => statusStok(p) === 'low');
    if (ui.filter === 'habis') arr = arr.filter((p) => statusStok(p) === 'out');
    if (ui.filter === 'nasi' || ui.filter === 'warung') arr = arr.filter((p) => p.pemilik === ui.filter);
    const q = ui.q.trim().toLowerCase();
    if (q) arr = arr.filter((p) => p.nama.toLowerCase().includes(q) || p.satuan.some((u) => u.barcode?.includes(q)));
    if (!aktif.length && !nonaktif.length) {
      listEl.replaceChildren(h('div', { class: 'card' }, empty({ ic: 'box', title: 'Belum ada barang', text: 'Mulai dengan barang yang paling sering dijual. Yang lain bisa didaftarkan saat di-scan.', action: button('Tambah barang', { icon: 'plus', onClick: () => ctx.go('/produk/baru') }) })));
      return;
    }
    listEl.replaceChildren(arr.length ? h('div', { class: 'list' }, arr.map((p) => h('a', { class: 'list-item', href: '#/produk/' + p.id },
      h('div', { class: 'li-main' },
        h('span', { class: 'li-title' }, p.nama),
        h('span', { class: 'li-sub' }, lapakTag(p.pemilik), p.kategori ? h('span', null, p.kategori) : null, p.satuan.length > 1 ? h('span', null, p.satuan.map((u) => u.nama).join('/')) : null)),
      h('div', { class: 'li-end' }, price(p.satuan[0].harga, 'sm'), stockTag(p)))))
      : h('div', { class: 'card' }, empty({ ic: 'search', title: 'Tidak ada yang cocok', text: q ? `Tidak ada barang dengan kata "${ui.q}".` : 'Tidak ada barang di saringan ini.' })));
  }
  input.addEventListener('input', () => { ui.q = input.value; render(); });
  render();

  return h('div', null,
    header({ title: 'Barang', sub: `${daftarProduk().length} barang aktif`, shift: state.device.shift, actions: [button('Tambah', { variant: 'ghost', icon: 'plus', onClick: () => ctx.go('/produk/baru') })] }),
    h('div', { class: 'page', style: { gap: '12px', paddingTop: '12px' } },
      h('div', { class: 'row', style: { gap: '8px' } },
        button('Barang masuk', { variant: 'secondary', icon: 'in', onClick: () => ctx.go('/masuk'), attrs: { style: 'flex:1' } }),
        button('Barang keluar', { variant: 'secondary', icon: 'out', onClick: () => ctx.go('/keluar'), attrs: { style: 'flex:1' } })),
      h('label', { class: 'search' }, icon('search'), input),
      chipsEl, listEl));
}

export const JENIS_MUTASI = { jual: 'Terjual', batal_jual: 'Batal jual', masuk: 'Barang masuk', stok_awal: 'Stok awal', stok_awal_harian: 'Stok hari ini', sisa_harian: 'Sisa (tutup)', rusak: 'Rusak / basi', kedaluwarsa: 'Kedaluwarsa', pakai_sendiri: 'Dipakai sendiri', hilang: 'Hilang', koreksi: 'Hitung ulang' };

export async function produkDetailScreen(ctx) {
  const p = state.produk.get(ctx.params.id);
  if (!p) return h('div', null, header({ title: 'Barang', back: '#/barang' }), h('div', { class: 'page' }, empty({ ic: 'alert', title: 'Barang tidak ditemukan', action: button('Kembali ke daftar', { onClick: () => ctx.go('/barang') }) })));
  const hist = await riwayatStok(p.id, 25);
  const st = statusStok(p);
  return h('div', null,
    header({ title: p.nama, sub: `${LAPAK[p.pemilik]}${p.kategori ? ' · ' + p.kategori : ''}`, back: '#/barang', actions: [button('Ubah', { variant: 'ghost', icon: 'edit', onClick: () => ctx.go(`/produk/${p.id}/ubah`) })] }),
    h('div', { class: 'page' },
      !p.aktif ? h('div', { class: 'alert alert-warning' }, icon('info', 'icon-sm'), h('div', null, 'Barang ini disembunyikan dari kasir.')) : null,
      h('section', { class: 'card stack' },
        h('div', { class: 'row-between' }, h('span', { class: 'stat-label' }, 'Stok sekarang'), st === 'low' ? h('span', { class: 'badge badge-warning' }, 'Menipis') : st === 'out' ? h('span', { class: 'badge badge-danger' }, p.stok < 0 ? 'Minus' : 'Habis') : null),
        p.modeStok === 'tanpa' ? h('p', { class: 'secondary' }, 'Barang ini tidak dihitung stoknya (dibuat saat dipesan).')
          : h('div', { class: 'price price-lg', style: { color: st === 'out' ? 'var(--color-danger)' : '' } }, teksStok(p)),
        p.stok < 0 ? h('p', { class: 'field-help' }, 'Stok minus berarti ada penjualan yang tidak tercatat masuknya. Cek fisik, lalu catat "Hitung ulang".') : null,
        p.modeStok !== 'tanpa' ? h('div', { class: 'row', style: { gap: '8px' } },
          button(p.modeStok === 'harian' ? 'Isi stok hari ini' : 'Barang masuk', { variant: 'secondary', icon: 'in', onClick: () => ctx.go(`/masuk?produk=${p.id}`), attrs: { style: 'flex:1' } }),
          button('Barang keluar', { variant: 'secondary', icon: 'out', onClick: () => ctx.go(`/keluar?produk=${p.id}`), attrs: { style: 'flex:1' } })) : null),
      h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, 'Harga jual'),
        h('div', { class: 'list' }, p.satuan.map((u) => h('div', { class: 'list-item', style: { minHeight: '56px' } },
          h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, 'Per ' + u.nama), h('span', { class: 'li-sub' }, u.isi > 1 ? `isi ${angka(u.isi)} ${p.satuanDasar}` : null, u.barcode ? h('span', { class: 'tnum' }, 'Barcode ' + u.barcode) : 'Tanpa barcode')),
          price(u.harga, 'sm')))),
        p.modalPerDasar ? h('p', { class: 'field-help' }, `Modal ${rupiah(p.modalPerDasar)} per ${p.satuanDasar} (dari barang masuk terakhir).`) : h('p', { class: 'field-help' }, 'Modal belum diisi, jadi laba barang ini belum dihitung.')),
      p.modeStok !== 'tanpa' ? h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, 'Riwayat stok'),
        hist.length ? h('div', { class: 'list' }, hist.map((m) => h('div', { class: 'list-item', style: { minHeight: '56px' } },
          h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, JENIS_MUTASI[m.jenis] || m.jenis), h('span', { class: 'li-sub' }, h('span', { class: 'tnum' }, `${tanggalPendek(m.tanggal)} ${jam(m.waktu)}`), m.oleh ? h('span', null, m.oleh) : null, m.alasan ? h('span', null, m.alasan) : null)),
          h('span', { class: 'price price-sm', style: { color: m.qty < 0 ? 'var(--color-danger)' : 'var(--color-success)' } }, (m.qty > 0 ? '+' : '−') + angka(Math.abs(m.qty)))))) : h('p', { class: 'secondary' }, 'Belum ada perubahan stok.')) : null,
      button(p.aktif ? 'Sembunyikan dari kasir' : 'Tampilkan lagi di kasir', { variant: p.aktif ? 'danger' : 'secondary', block: true, onClick: async () => {
        if (p.aktif && !(await confirmDialog({ title: `Sembunyikan ${p.nama}?`, text: 'Barang tidak muncul di kasir, tapi riwayat penjualannya tetap ada. Bisa ditampilkan lagi kapan saja.', ok: 'Sembunyikan', danger: true }))) return;
        await setAktif(p.id, !p.aktif); toast(p.aktif ? 'Barang disembunyikan' : 'Barang ditampilkan lagi'); ctx.go('/barang');
      } })));
}
