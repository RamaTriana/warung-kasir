// Data contoh untuk mencoba aplikasi. Nama barang & harga mengikuti warung sungguhan,
// barcode berformat EAN-13 dengan awalan 899 (Indonesia) tetapi BUKAN barcode asli produk.
import * as db from './db.js';
import { state, simpanProduk, jual, batalkan, barangKeluar, catatPengeluaran, init, simpanSettings, DEFAULT_KATEGORI } from './store.js';
import { hariIniKey, geserHari } from './format.js';

function ean(base12) { const d = base12.split('').map(Number); const s = d.reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0); return base12 + ((10 - (s % 10)) % 10); }
let seq = 100;
const bc = () => ean('8991234' + String(seq++).padStart(5, '0'));

const PRODUK = [
  // Lapak Nasi (istri pakde)
  { pemilik: 'nasi', nama: 'Nasi Kuning Biasa', kategori: 'Nasi', modeStok: 'harian', satuanDasar: 'porsi', satuan: [{ nama: 'porsi', isi: 1, harga: 10000 }], stokAwal: 30, favorit: true },
  { pemilik: 'nasi', nama: 'Nasi Kuning Telur', kategori: 'Nasi', modeStok: 'harian', satuanDasar: 'porsi', satuan: [{ nama: 'porsi', isi: 1, harga: 13000 }], stokAwal: 20, favorit: true },
  { pemilik: 'nasi', nama: 'Nasi Kuning Ayam Suwir', kategori: 'Nasi', modeStok: 'harian', satuanDasar: 'porsi', satuan: [{ nama: 'porsi', isi: 1, harga: 15000 }], stokAwal: 15, favorit: true },
  { pemilik: 'nasi', nama: 'Telur Balado', kategori: 'Lauk', modeStok: 'harian', satuanDasar: 'butir', satuan: [{ nama: 'butir', isi: 1, harga: 4000 }], stokAwal: 20 },
  { pemilik: 'nasi', nama: 'Kue Lapis', kategori: 'Jajanan', modeStok: 'harian', satuanDasar: 'potong', satuan: [{ nama: 'potong', isi: 1, harga: 2000 }], stokAwal: 25, favorit: true },
  { pemilik: 'nasi', nama: 'Pisang Goreng', kategori: 'Jajanan', modeStok: 'harian', satuanDasar: 'buah', satuan: [{ nama: 'buah', isi: 1, harga: 2000 }], stokAwal: 30, favorit: true },
  { pemilik: 'nasi', nama: 'Bakwan Sayur', kategori: 'Jajanan', modeStok: 'harian', satuanDasar: 'buah', satuan: [{ nama: 'buah', isi: 1, harga: 1500 }], stokAwal: 30 },
  // Lapak Warung (ibu pakde)
  { pemilik: 'warung', nama: 'Es Teh Manis', kategori: 'Minuman', modeStok: 'tanpa', satuanDasar: 'gelas', satuan: [{ nama: 'gelas', isi: 1, harga: 4000 }], favorit: true, modal: 1200 },
  { pemilik: 'warung', nama: 'Es Jeruk', kategori: 'Minuman', modeStok: 'tanpa', satuanDasar: 'gelas', satuan: [{ nama: 'gelas', isi: 1, harga: 5000 }], modal: 2000 },
  { pemilik: 'warung', nama: 'Teh Botol Sosro 450 ml', kategori: 'Minuman', modeStok: 'hitung', satuanDasar: 'botol', satuan: [{ nama: 'botol', isi: 1, harga: 5000, barcode: true }], stokAwal: 18, stokMin: 6, modal: 3900, favorit: true },
  { pemilik: 'warung', nama: 'Aqua 600 ml', kategori: 'Minuman', modeStok: 'hitung', satuanDasar: 'botol', satuan: [{ nama: 'botol', isi: 1, harga: 4000, barcode: true }], stokAwal: 24, stokMin: 6, modal: 3000, favorit: true },
  { pemilik: 'warung', nama: 'Kopi Kapal Api Mix', kategori: 'Minuman', modeStok: 'hitung', satuanDasar: 'sachet', satuan: [{ nama: 'sachet', isi: 1, harga: 1500, barcode: true }, { nama: 'renceng', isi: 10, harga: 14000, barcode: true }], stokAwal: 40, stokMin: 10, modal: 1200 },
  { pemilik: 'warung', nama: 'Indomie Goreng', kategori: 'Mi & makanan', modeStok: 'hitung', satuanDasar: 'bungkus', satuan: [{ nama: 'bungkus', isi: 1, harga: 3500, barcode: true }, { nama: 'dus', isi: 40, harga: 125000, barcode: true }], stokAwal: 36, stokMin: 10, modal: 2950, favorit: true },
  { pemilik: 'warung', nama: 'Indomie Soto', kategori: 'Mi & makanan', modeStok: 'hitung', satuanDasar: 'bungkus', satuan: [{ nama: 'bungkus', isi: 1, harga: 3500, barcode: true }], stokAwal: 7, stokMin: 10, modal: 2900 },
  { pemilik: 'warung', nama: 'Gudang Garam Filter 12', kategori: 'Rokok', modeStok: 'hitung', satuanDasar: 'batang', satuan: [{ nama: 'batang', isi: 1, harga: 2500 }, { nama: 'bungkus', isi: 12, harga: 27000, barcode: true }], stokAwal: 120, stokMin: 24, modal: 2050, favorit: true },
  { pemilik: 'warung', nama: 'Sampoerna Mild 16', kategori: 'Rokok', modeStok: 'hitung', satuanDasar: 'batang', satuan: [{ nama: 'batang', isi: 1, harga: 2000 }, { nama: 'bungkus', isi: 16, harga: 32000, barcode: true }], stokAwal: 70, stokMin: 32, modal: 1880 },
  { pemilik: 'warung', nama: 'Beras Medium', kategori: 'Sembako', modeStok: 'hitung', satuanDasar: 'kg', satuan: [{ nama: 'kg', isi: 1, harga: 14000 }, { nama: '½ kg', isi: 0.5, harga: 7000 }], stokAwal: 22, stokMin: 5, modal: 12500 },
  { pemilik: 'warung', nama: 'Gula Pasir', kategori: 'Sembako', modeStok: 'hitung', satuanDasar: 'kg', satuan: [{ nama: 'kg', isi: 1, harga: 18000 }, { nama: '¼ kg', isi: 0.25, harga: 4500 }], stokAwal: 3, stokMin: 3, modal: 16500 },
  { pemilik: 'warung', nama: 'Telur Ayam', kategori: 'Sembako', modeStok: 'hitung', satuanDasar: 'butir', satuan: [{ nama: 'butir', isi: 1, harga: 2200 }], stokAwal: 45, stokMin: 15, modal: 1850 },
  { pemilik: 'warung', nama: 'Minyak Goreng 1 L', kategori: 'Sembako', modeStok: 'hitung', satuanDasar: 'pouch', satuan: [{ nama: 'pouch', isi: 1, harga: 19000, barcode: true }], stokAwal: 6, stokMin: 3, modal: 17200 },
  { pemilik: 'warung', nama: 'Kecap Manis Sachet', kategori: 'Bumbu', modeStok: 'hitung', satuanDasar: 'sachet', satuan: [{ nama: 'sachet', isi: 1, harga: 1000 }], stokAwal: 48, stokMin: 12, modal: 750 },
  { pemilik: 'warung', nama: 'Sabun Mandi Batang', kategori: 'Rumah tangga', modeStok: 'hitung', satuanDasar: 'pcs', satuan: [{ nama: 'pcs', isi: 1, harga: 4000, barcode: true }], stokAwal: 0, stokMin: 4, modal: 3200 },
  { pemilik: 'warung', nama: 'Deterjen Sachet', kategori: 'Rumah tangga', modeStok: 'hitung', satuanDasar: 'sachet', satuan: [{ nama: 'sachet', isi: 1, harga: 1000, barcode: true }], stokAwal: 30, stokMin: 10, modal: 800 },
];

// PRNG deterministik supaya data contoh selalu sama
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

export async function isiDataContoh() {
  await simpanSettings({ ...(state.settings || {}), namaWarung: state.settings?.namaWarung || 'Warung Bu Darmi', kategori: DEFAULT_KATEGORI });
  const dibuat = [];
  for (const p of PRODUK) {
    dibuat.push(await simpanProduk({ ...p, modalPerDasar: p.modal || 0, satuan: p.satuan.map((u) => ({ ...u, barcode: u.barcode ? bc() : '' })) }));
  }
  // Riwayat 13 hari terakhir: 10–30 transaksi per hari, pagi (nasi + warung) dan siang (warung)
  const r = rng(42);
  const nasi = dibuat.filter((p) => p.pemilik === 'nasi');
  const warung = dibuat.filter((p) => p.pemilik === 'warung');
  const devAsli = { ...state.device };
  const today = hariIniKey();
  for (let d = 13; d >= 0; d--) {
    const tgl = geserHari(today, -d);
    const n = 10 + Math.floor(r() * 18);
    for (let k = 0; k < n; k++) {
      const pagi = k < n * 0.55;
      if (d === 0 && !pagi) continue; // hari ini baru shift pagi
      const jamMenit = pagi ? 6 * 60 + Math.floor(r() * 270) : 11 * 60 + Math.floor(r() * 480);
      const waktu = new Date(`${tgl}T${String(Math.floor(jamMenit / 60)).padStart(2, '0')}:${String(jamMenit % 60).padStart(2, '0')}:00+08:00`).toISOString();
      if (d === 0 && new Date(waktu) > new Date()) continue;
      const items = [];
      const pool = pagi ? (r() < 0.7 ? nasi : warung) : warung;
      const jml = 1 + Math.floor(r() * 3);
      for (let j = 0; j < jml; j++) {
        const p = pool[Math.floor(r() * pool.length)];
        const u = p.satuan[Math.floor(r() * p.satuan.length)];
        if (u.isi >= 10 && r() < 0.8) continue;
        const ada = items.find((x) => x.produkId === p.id && x.satuan === u.nama);
        if (ada) ada.qty += 1; else items.push({ produkId: p.id, pemilik: p.pemilik, nama: p.nama, satuan: u.nama, isi: u.isi, harga: u.harga, modal: (p.modalPerDasar || 0) * u.isi, qty: 1 + (r() < 0.25 ? 1 : 0) });
      }
      if (pagi && r() < 0.3) { const p = warung[Math.floor(r() * 3)]; items.push({ produkId: p.id, pemilik: 'warung', nama: p.nama, satuan: p.satuan[0].nama, isi: 1, harga: p.satuan[0].harga, modal: p.modalPerDasar, qty: 1 }); }
      if (!items.length) continue;
      const total = items.reduce((s, i) => s + i.harga * i.qty, 0);
      const pecahan = [total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, 50000, 100000].filter((v) => v >= total);
      state.device = { ...devAsli, shift: pagi ? 'pagi' : 'siang', nama: pagi ? 'Bu Sri' : 'Ibu', id: pagi ? devAsli.id : 'hp-ibu-contoh' };
      const rec = await jual({ items, dibayar: pecahan[Math.floor(r() * pecahan.length)], waktu });
      if (r() < 0.03) await batalkan(rec.id, 'Salah tekan');
    }
  }
  state.device = devAsli;
  // Samakan stok dengan keadaan "sekarang" yang realistis (riwayat 2 minggu di atas sudah mengurangi stok)
  const terjualHariIni = new Map();
  (await db.range('penjualan', 'tanggal', today, today)).filter((t) => t.status === 'selesai').forEach((t) => t.items.forEach((i) => i.produkId && terjualHariIni.set(i.produkId, (terjualHariIni.get(i.produkId) || 0) + i.qty * i.isi)));
  for (let i = 0; i < dibuat.length; i++) {
    const p = state.produk.get(dibuat[i].id);
    if (p.modeStok === 'tanpa') continue;
    const target = p.modeStok === 'harian' ? Math.max(0, (PRODUK[i].stokAwal || 0) - (terjualHariIni.get(p.id) || 0)) : PRODUK[i].stokAwal || 0;
    if (target !== p.stok) await barangKeluar({ produkId: p.id, jenis: 'koreksi', stokSebenarnya: target, catatan: 'Data contoh' });
  }
  await catatPengeluaran({ kategori: 'Gas', nominal: 22000, pemilik: 'nasi', dariLaci: true, catatan: 'Tabung 3 kg' });
  await catatPengeluaran({ kategori: 'Bahan baku', nominal: 85000, pemilik: 'nasi', dariLaci: false, catatan: 'Beras, kelapa, ayam' });
  // Data contoh tidak perlu dikirim ke Google
  const all = await db.getAll('outbox');
  await db.tx(['outbox'], (api) => { all.forEach((o) => api.del('outbox', o.seq)); });
  await init();
}
