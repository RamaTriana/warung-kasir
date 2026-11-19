// TUTUP SHIFT — hitung uang laci, lihat selisih, dan pembagian uang Nasi / Warung (setor ke Ibu).
import { h, icon, button, header, field, moneyInput, price, lapakTag, empty, confirmDialog, toast, qtyControl, alertBox } from '../ui.js';
import { state, rekapSesi, tutupSesi, barangKeluar, daftarProduk } from '../store.js';
import { jam, rupiah, SHIFT, angka } from '../format.js';

export async function tutupScreen(ctx) {
  const sesi = state.sesi;
  if (!sesi) return h('div', null, header({ title: 'Tutup shift', back: '#/hari-ini' }),
    h('div', { class: 'page' }, empty({ ic: 'lock', title: 'Tidak ada shift yang berjalan', text: 'Shift dimulai otomatis saat membuka Kasir.', action: button('Buka kasir', { onClick: () => ctx.go('/kasir') }) })));

  const r = await rekapSesi(sesi);
  const harian = daftarProduk().filter((p) => p.modeStok === 'harian' && (p.stok || 0) > 0);
  const sisa = Object.fromEntries(harian.map((p) => [p.id, p.stok]));
  let kas = null;
  const selisihEl = h('div', { 'aria-live': 'polite' });
  const duaLapak = sesi.shift === 'pagi' && (r.per.nasi.jual || r.per.nasi.pengeluaran) && (r.per.warung.jual || r.per.warung.pengeluaran || sesi.kasAwal);

  function showSelisih() {
    if (kas == null) { selisihEl.replaceChildren(); return; }
    const d = kas - r.kasSeharusnya;
    selisihEl.replaceChildren(d === 0
      ? alertBox('success', 'checkCircle', h('strong', null, 'Uang pas. Tidak ada selisih.'))
      : alertBox(d > 0 ? 'info' : 'danger', 'alert', h('div', null, h('strong', null, d > 0 ? `Lebih ${rupiah(d)}` : `Kurang ${rupiah(-d)}`), h('p', null, d > 0 ? 'Mungkin ada kembalian yang belum diberikan atau penjualan yang belum dicatat.' : 'Cek transaksi yang lupa dicatat atau pengeluaran dari laci yang belum dimasukkan.'))));
  }

  const baris = (label, v, neg) => h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, h('span', { class: 'price price-sm', style: { color: neg && v ? 'var(--color-danger)' : '' } }, (neg && v ? '− ' : '') + rupiah(v))));

  async function tutup() {
    if (kas == null && !(await confirmDialog({ title: 'Tutup tanpa menghitung uang?', text: 'Selisih kas tidak akan tercatat untuk shift ini.', ok: 'Tutup saja' }))) return;
    if (kas != null && !(await confirmDialog({ title: `Tutup shift ${SHIFT[sesi.shift].toLowerCase()}?`, text: 'Setelah ditutup, shift berikutnya dimulai dari Kasir.', ok: 'Tutup shift' }))) return;
    for (const p of harian) {
      const nyata = sisa[p.id];
      if (nyata !== p.stok) await barangKeluar({ produkId: p.id, jenis: 'koreksi', stokSebenarnya: nyata, catatan: 'Hitung sisa saat tutup shift' });
      if (nyata > 0) await barangKeluar({ produkId: p.id, jenis: 'sisa_harian', qtyDasar: nyata, catatan: 'Sisa tidak terjual' });
    }
    const s = await tutupSesi(kas);
    toast('Shift ditutup');
    ctx.go('/hari-ini');
    return s;
  }

  showSelisih();
  return h('div', null,
    header({ title: `Tutup shift ${SHIFT[sesi.shift].toLowerCase()}`, sub: `Mulai ${jam(sesi.dibuka)} · ${r.transaksi} transaksi`, back: '#/hari-ini', shift: sesi.shift }),
    h('div', { class: 'page' },
      h('section', { class: 'card' },
        h('dl', { class: 'stack', style: { gap: 0 } },
          baris(sesi.kasAwalDiisi ? 'Uang laci awal' : 'Uang laci awal (tidak diisi)', sesi.kasAwal || 0),
          r.per.nasi.jual || sesi.shift === 'pagi' ? baris('Penjualan Nasi', r.per.nasi.jual) : null,
          baris('Penjualan Warung', r.per.warung.jual),
          baris('Pengeluaran dari laci', r.per.nasi.pengeluaran + r.per.warung.pengeluaran, true),
          baris('Belanja barang dari laci', r.per.nasi.belanja + r.per.warung.belanja, true)),
        h('div', { class: 'divider-dashed' }),
        h('div', { class: 'row-between' }, h('strong', null, 'Seharusnya di laci'), price(r.kasSeharusnya, 'lg'))),

      h('section', { class: 'section' },
        field('Uang di laci sekarang', moneyInput(0, (v) => { kas = v || v === 0 ? v : null; if (!v) kas = null; showSelisih(); }, { autofocus: true }), { help: 'Hitung semua uang kertas dan koin.' }),
        selisihEl),

      harian.length ? h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, 'Sisa yang tidak terjual'),
        h('div', { class: 'list' }, harian.map((p) => h('div', { class: 'list-item' },
          h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, p.nama), h('span', { class: 'li-sub' }, `tercatat ${angka(p.stok)} ${p.satuanDasar}`)),
          qtyControl(p.stok, (v) => (sisa[p.id] = v), { min: 0, label: 'Sisa ' + p.nama })))),
        h('p', { class: 'field-help' }, 'Sisa dicatat keluar dari stok supaya besok mulai dari nol.')) : null,

      duaLapak ? h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, 'Pembagian uang'),
        h('div', { class: 'stat-grid' },
          h('div', null, lapakTag('nasi'), price(r.setor.nasi, 'md'), h('span', { class: 'stat-note' }, 'disimpan penjaga pagi')),
          h('div', null, lapakTag('warung'), price(r.setor.warung, 'md'), h('span', { class: 'stat-note' }, 'serahkan ke Ibu'))),
        h('p', { class: 'field-help' }, 'Uang laci awal dihitung milik Warung. Kalau ada selisih, bicarakan bersama sebelum dibagi.')) : null,

      h('div', { class: 'sticky-foot' }, button('Tutup shift', { size: 'lg', block: true, icon: 'lock', onClick: tutup }))));
}
