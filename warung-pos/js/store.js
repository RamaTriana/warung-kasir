// Logika bisnis. Aturan utama (lihat SRS bagian 8):
// 1. Stok hanya berubah lewat mutasi. Setiap mutasi diterapkan tepat sekali (berdasarkan UUID).
// 2. Uang = bilangan bulat rupiah. Harga & modal disalin (snapshot) ke setiap item penjualan.
// 3. Tidak ada yang dihapus: pembatalan = status 'batal' + mutasi pengembalian.
// 4. Setiap perubahan ikut masuk outbox dalam transaksi database yang sama.
import * as db from './db.js';
import { tanggalKey, hariIniKey, geserHari } from './format.js';

export const state = {
  device: null,     // { id, nama, shift: 'pagi'|'siang' }
  settings: null,   // { namaWarung, kategori: { nasi: [], warung: [] } }
  produk: new Map(),
  sesi: null,
  cart: [],
  listeners: new Set(),
};
export const onChange = (fn) => { state.listeners.add(fn); return () => state.listeners.delete(fn); };
export const emit = (what) => state.listeners.forEach((fn) => fn(what));

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export const DEFAULT_KATEGORI = {
  nasi: ['Nasi', 'Lauk', 'Jajanan'],
  warung: ['Minuman', 'Mi & makanan', 'Rokok', 'Sembako', 'Bumbu', 'Rumah tangga', 'Lainnya'],
};
export const KATEGORI_PENGELUARAN = ['Bahan baku', 'Gas', 'Listrik', 'Transportasi', 'Operasional', 'Lainnya'];
export const ALASAN_KELUAR = [
  ['rusak', 'Rusak / basi'], ['kedaluwarsa', 'Kedaluwarsa'], ['pakai_sendiri', 'Dipakai sendiri'], ['hilang', 'Hilang'], ['koreksi', 'Hitung ulang'],
];

// ---- Boot ------------------------------------------------------------------
export async function init() {
  state.device = await db.getMeta('device');
  state.settings = (await db.getMeta('settings')) || { namaWarung: 'Warung', kategori: DEFAULT_KATEGORI };
  const list = await db.getAll('produk');
  state.produk = new Map(list.map((p) => [p.id, p]));
  await muatSesi();
  return state;
}
export async function simpanDevice(device) { state.device = device; await db.setMeta('device', device); emit('device'); }
export async function simpanSettings(s) { state.settings = s; await db.setMeta('settings', s); emit('settings'); }

const outbox = (api, store, data) => api.add('outbox', { store, id: data.id, data, t: now() });

// ---- Produk ----------------------------------------------------------------
export function daftarProduk({ pemilik, aktif = true } = {}) {
  let arr = [...state.produk.values()];
  if (aktif !== null) arr = arr.filter((p) => !!p.aktif === aktif);
  if (pemilik) arr = arr.filter((p) => p.pemilik === pemilik);
  return arr.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}
export function cariBarcode(code) {
  const c = String(code).trim();
  for (const p of state.produk.values()) {
    if (!p.aktif) continue;
    const u = (p.satuan || []).find((s) => s.barcode && s.barcode === c);
    if (u) return { produk: p, satuan: u };
  }
  return null;
}
export function pemilikBolehDijual(shift) { return shift === 'siang' ? ['warung', 'nasi'] : ['nasi', 'warung']; }

export async function simpanProduk(input) {
  const lama = input.id ? state.produk.get(input.id) : null;
  const t = now();
  const p = {
    id: input.id || uid(),
    pemilik: input.pemilik,
    nama: input.nama.trim(),
    kategori: input.kategori || '',
    satuanDasar: input.satuanDasar.trim(),
    satuan: input.satuan.map((u) => ({ id: u.id || uid(), nama: u.nama.trim(), isi: Number(u.isi) || 1, harga: Math.round(u.harga || 0), barcode: (u.barcode || '').trim() })),
    modalPerDasar: Math.round(input.modalPerDasar || 0),
    modeStok: input.modeStok,
    stokMin: Number(input.stokMin) || 0,
    favorit: !!input.favorit,
    aktif: input.aktif !== false,
    stok: lama ? lama.stok : 0,
    dibuat: lama ? lama.dibuat : t,
    diubah: t,
  };
  await db.tx(['produk', 'mutasi', 'outbox'], async (api) => {
    api.put('produk', p);
    outbox(api, 'produk', stripStok(p));
    if (!lama && input.stokAwal && p.modeStok !== 'tanpa') {
      const m = mutasiBaru(p, 'stok_awal', Number(input.stokAwal), { alasan: 'Stok awal' });
      api.put('mutasi', m); outbox(api, 'mutasi', m);
      p.stok += m.qty; api.put('produk', p);
    }
  });
  state.produk.set(p.id, p);
  emit('produk');
  return p;
}
const stripStok = ({ stok, ...rest }) => rest; // stok tidak disinkron: dihitung dari mutasi di tiap HP

export async function setAktif(id, aktif) {
  const p = { ...state.produk.get(id), aktif, diubah: now() };
  await db.tx(['produk', 'outbox'], (api) => { api.put('produk', p); outbox(api, 'produk', stripStok(p)); });
  state.produk.set(id, p); emit('produk');
}

function mutasiBaru(p, jenis, qty, extra = {}) {
  const t = extra.waktu || now();
  return { id: uid(), produkId: p.id, pemilik: p.pemilik, nama: p.nama, jenis, qty: Math.round(qty * 1000) / 1000, waktu: t, tanggal: tanggalKey(t), oleh: state.device?.nama || '', deviceId: state.device?.id || '', ...extra };
}
async function terapkanMutasi(api, m) {
  const p = await api.get('produk', m.produkId);
  if (!p) return;
  p.stok = Math.round(((p.stok || 0) + m.qty) * 1000) / 1000;
  api.put('produk', p);
  state.produk.set(p.id, p);
}

// ---- Penjualan ---------------------------------------------------------------
export function totalKeranjang(cart = state.cart) { return cart.reduce((s, i) => s + Math.round(i.harga * i.qty), 0); }

export async function jual({ items, dibayar, waktu }) {
  if (!items.length) throw new Error('Keranjang kosong');
  const total = totalKeranjang(items);
  if (dibayar < total) throw new Error('Uang dibayar kurang dari total');
  const t = waktu || now();
  const tanggal = tanggalKey(t);
  const shift = state.device.shift;
  const rec = {
    id: uid(), no: '', waktu: t, tanggal, shift, penjaga: state.device.nama, deviceId: state.device.id, sesiId: state.sesi?.id || null,
    items: items.map((i) => ({ produkId: i.produkId || null, pemilik: i.pemilik, nama: i.nama, satuan: i.satuan, isi: i.isi || 1, qty: i.qty, harga: i.harga, modal: Math.round(i.modal || 0), subtotal: Math.round(i.harga * i.qty), manual: !!i.manual })),
    total, dibayar, kembalian: dibayar - total, metode: 'tunai', status: 'selesai', diubah: t,
  };
  await db.tx(['penjualan', 'mutasi', 'produk', 'outbox', 'meta'], async (api) => {
    const key = `seq-${tanggal}-${state.device.id}`;
    const seq = ((await api.get('meta', key))?.value || 0) + 1;
    api.put('meta', { key, value: seq });
    rec.no = `${shift === 'pagi' ? 'P' : 'S'}${tanggal.slice(5).replace('-', '')}-${String(seq).padStart(3, '0')}`;
    api.put('penjualan', rec); outbox(api, 'penjualan', rec);
    for (const it of rec.items) {
      if (!it.produkId) continue;
      const p = state.produk.get(it.produkId);
      if (!p || p.modeStok === 'tanpa') continue;
      const m = mutasiBaru(p, 'jual', -(it.qty * it.isi), { ref: rec.id, waktu: t });
      api.put('mutasi', m); outbox(api, 'mutasi', m);
      await terapkanMutasi(api, m);
    }
  });
  emit('penjualan'); emit('produk');
  return rec;
}

export async function batalkan(id, alasan) {
  const rec = await db.get('penjualan', id);
  if (!rec || rec.status === 'batal') return rec;
  const t = now();
  const baru = { ...rec, status: 'batal', alasanBatal: alasan, waktuBatal: t, dibatalkanOleh: state.device.nama, diubah: t };
  await db.tx(['penjualan', 'mutasi', 'produk', 'outbox'], async (api) => {
    api.put('penjualan', baru); outbox(api, 'penjualan', baru);
    for (const it of rec.items) {
      if (!it.produkId) continue;
      const p = state.produk.get(it.produkId);
      if (!p || p.modeStok === 'tanpa') continue;
      const m = mutasiBaru(p, 'batal_jual', it.qty * it.isi, { ref: rec.id, alasan });
      api.put('mutasi', m); outbox(api, 'mutasi', m);
      await terapkanMutasi(api, m);
    }
  });
  emit('penjualan'); emit('produk');
  return baru;
}

// ---- Barang masuk / keluar ------------------------------------------------
export async function barangMasuk({ pemasok, dariLaci, items, catatan }) {
  const t = now();
  const rec = { id: uid(), waktu: t, tanggal: tanggalKey(t), shift: state.device.shift, sesiId: state.sesi?.id || null, oleh: state.device.nama, pemasok: pemasok || '', dariLaci: !!dariLaci, catatan: catatan || '',
    items: items.map((i) => { const p = state.produk.get(i.produkId); return { produkId: i.produkId, pemilik: p.pemilik, nama: p.nama, satuan: i.satuan, isi: i.isi, qty: i.qty, hargaBeli: Math.round(i.hargaBeli || 0) }; }),
    diubah: t };
  rec.total = rec.items.reduce((s, i) => s + i.qty * i.hargaBeli, 0);
  await db.tx(['masuk', 'mutasi', 'produk', 'outbox'], async (api) => {
    api.put('masuk', rec); outbox(api, 'masuk', rec);
    for (const it of rec.items) {
      const p = state.produk.get(it.produkId);
      const m = mutasiBaru(p, p.modeStok === 'harian' ? 'stok_awal_harian' : 'masuk', it.qty * it.isi, { ref: rec.id });
      api.put('mutasi', m); outbox(api, 'mutasi', m);
      await terapkanMutasi(api, m);
      if (it.hargaBeli > 0) {
        const pp = { ...state.produk.get(p.id), modalPerDasar: Math.round(it.hargaBeli / it.isi), diubah: t };
        api.put('produk', pp); outbox(api, 'produk', stripStok(pp)); state.produk.set(pp.id, pp);
      }
    }
  });
  emit('produk');
  return rec;
}

export async function barangKeluar({ produkId, jenis, qtyDasar, stokSebenarnya, catatan }) {
  const p = state.produk.get(produkId);
  const delta = jenis === 'koreksi' ? (stokSebenarnya - (p.stok || 0)) : -Math.abs(qtyDasar);
  if (!delta) return null;
  const m = mutasiBaru(p, jenis, delta, { alasan: catatan || '', sesiId: state.sesi?.id || null });
  await db.tx(['mutasi', 'produk', 'outbox'], async (api) => { api.put('mutasi', m); outbox(api, 'mutasi', m); await terapkanMutasi(api, m); });
  emit('produk');
  return m;
}
export async function riwayatStok(produkId, limit = 20) {
  const list = await db.byIndex('mutasi', 'produkId', produkId);
  return list.sort((a, b) => b.waktu.localeCompare(a.waktu)).slice(0, limit);
}

// ---- Pengeluaran ------------------------------------------------------------
export async function catatPengeluaran({ kategori, nominal, pemilik, dariLaci, catatan }) {
  const t = now();
  const rec = { id: uid(), waktu: t, tanggal: tanggalKey(t), shift: state.device.shift, sesiId: state.sesi?.id || null, oleh: state.device.nama, kategori, nominal: Math.round(nominal), pemilik, dariLaci: !!dariLaci, catatan: catatan || '', status: 'aktif', diubah: t };
  await db.tx(['pengeluaran', 'outbox'], (api) => { api.put('pengeluaran', rec); outbox(api, 'pengeluaran', rec); });
  emit('pengeluaran');
  return rec;
}
export async function batalPengeluaran(id) {
  const r = await db.get('pengeluaran', id);
  const t = now();
  const baru = { ...r, status: 'batal', diubah: t };
  await db.tx(['pengeluaran', 'outbox'], (api) => { api.put('pengeluaran', baru); outbox(api, 'pengeluaran', baru); });
  emit('pengeluaran');
}

// ---- Sesi (shift) ------------------------------------------------------------
async function muatSesi() {
  const id = await db.getMeta('sesiAktif');
  state.sesi = id ? await db.get('sesi', id) : null;
  // Lupa tutup kemarin → tutup otomatis, kas tidak dihitung
  if (state.sesi && state.sesi.tanggal !== hariIniKey()) {
    const r = await rekapSesi(state.sesi);
    const s = { ...state.sesi, ...r, status: 'tutup', ditutup: now(), kasDihitung: null, selisih: null, otomatis: true, diubah: now() };
    await db.tx(['sesi', 'outbox', 'meta'], (api) => { api.put('sesi', s); outbox(api, 'sesi', s); api.put('meta', { key: 'sesiAktif', value: null }); });
    state.sesi = null;
  }
}
export async function bukaSesi(kasAwal) {
  const t = now();
  const s = { id: uid(), shift: state.device.shift, penjaga: state.device.nama, deviceId: state.device.id, tanggal: tanggalKey(t), dibuka: t, kasAwal: Math.round(kasAwal || 0), kasAwalDiisi: kasAwal != null, status: 'buka', diubah: t };
  await db.tx(['sesi', 'outbox', 'meta'], (api) => { api.put('sesi', s); outbox(api, 'sesi', s); api.put('meta', { key: 'sesiAktif', value: s.id }); });
  state.sesi = s; emit('sesi');
  return s;
}
export async function rekapSesi(sesi) {
  const jual = (await db.getAll('penjualan')).filter((p) => p.sesiId === sesi.id && p.status === 'selesai');
  const peng = (await db.getAll('pengeluaran')).filter((p) => p.sesiId === sesi.id && p.status === 'aktif');
  const masuk = (await db.getAll('masuk')).filter((p) => p.sesiId === sesi.id && p.dariLaci);
  const per = { nasi: { jual: 0, pengeluaran: 0, belanja: 0 }, warung: { jual: 0, pengeluaran: 0, belanja: 0 } };
  for (const j of jual) for (const it of j.items) per[it.pemilik].jual += it.subtotal;
  for (const p of peng) if (p.dariLaci) per[p.pemilik].pengeluaran += p.nominal;
  for (const m of masuk) for (const it of m.items) per[it.pemilik].belanja += it.qty * it.hargaBeli;
  const kasAwal = sesi.kasAwal || 0;
  const setor = {
    nasi: per.nasi.jual - per.nasi.pengeluaran - per.nasi.belanja,
    warung: kasAwal + per.warung.jual - per.warung.pengeluaran - per.warung.belanja,
  };
  return { transaksi: jual.length, per, kasSeharusnya: setor.nasi + setor.warung, setor };
}
export async function tutupSesi(kasDihitung) {
  const r = await rekapSesi(state.sesi);
  const t = now();
  const s = { ...state.sesi, ...r, kasDihitung: kasDihitung == null ? null : Math.round(kasDihitung), selisih: kasDihitung == null ? null : Math.round(kasDihitung) - r.kasSeharusnya, status: 'tutup', ditutup: t, diubah: t };
  await db.tx(['sesi', 'outbox', 'meta'], (api) => { api.put('sesi', s); outbox(api, 'sesi', s); api.put('meta', { key: 'sesiAktif', value: null }); });
  state.sesi = null; emit('sesi');
  return s;
}

// ---- Laporan ---------------------------------------------------------------
export async function penjualanRentang(dari, sampai) { return db.range('penjualan', 'tanggal', dari, sampai); }

export async function laporan({ dari, sampai, pemilik = null, shift = null }) {
  const semua = await penjualanRentang(dari, sampai);
  const peng = (await db.range('pengeluaran', 'tanggal', dari, sampai)).filter((p) => p.status === 'aktif' && (!pemilik || p.pemilik === pemilik) && (!shift || p.shift === shift));
  const r = { omzet: 0, modal: 0, transaksi: 0, batal: 0, pengeluaran: 0, perHari: new Map(), perShift: { pagi: 0, siang: 0 }, perPemilik: { nasi: 0, warung: 0 }, terlaris: new Map(), adaModalKosong: false };
  for (const j of semua) {
    if (shift && j.shift !== shift) continue;
    if (j.status !== 'selesai') { r.batal++; continue; }
    const items = j.items.filter((i) => !pemilik || i.pemilik === pemilik);
    if (!items.length) continue;
    r.transaksi++;
    for (const it of items) {
      r.omzet += it.subtotal;
      r.modal += it.modal * it.qty;
      if (!it.modal && it.pemilik === 'warung') r.adaModalKosong = true;
      r.perShift[j.shift] += it.subtotal;
      r.perPemilik[it.pemilik] += it.subtotal;
      r.perHari.set(j.tanggal, (r.perHari.get(j.tanggal) || 0) + it.subtotal);
      const k = it.nama + '|' + it.satuan;
      const t = r.terlaris.get(k) || { nama: it.nama, satuan: it.satuan, pemilik: it.pemilik, qty: 0, omzet: 0 };
      t.qty += it.qty; t.omzet += it.subtotal; r.terlaris.set(k, t);
    }
  }
  for (const p of peng) r.pengeluaran += p.nominal;
  r.laba = r.omzet - r.modal - r.pengeluaran;
  r.terlarisList = [...r.terlaris.values()].sort((a, b) => b.omzet - a.omzet);
  r.pengeluaranList = peng.sort((a, b) => b.waktu.localeCompare(a.waktu));
  return r;
}
export function stokMenipis() {
  return daftarProduk().filter((p) => p.modeStok === 'hitung' && (p.stok <= 0 || (p.stokMin && p.stok <= p.stokMin))).sort((a, b) => a.stok - b.stok);
}
export const rentangPreset = {
  hariIni: () => { const k = hariIniKey(); return { dari: k, sampai: k }; },
  kemarin: () => { const k = geserHari(hariIniKey(), -1); return { dari: k, sampai: k }; },
  tujuhHari: () => ({ dari: geserHari(hariIniKey(), -6), sampai: hariIniKey() }),
  bulanIni: () => { const k = hariIniKey(); return { dari: k.slice(0, 8) + '01', sampai: k }; },
  bulanLalu: () => { const k = hariIniKey(); const awal = k.slice(0, 8) + '01'; const akhir = geserHari(awal, -1); return { dari: akhir.slice(0, 8) + '01', sampai: akhir }; },
};

// ---- Gabung data dari HP lain (sinkronisasi) ---------------------------------
// Aturan: mutasi diterapkan tepat sekali; catatan lain memakai versi 'diubah' terbaru;
// stok produk lokal tidak pernah ditimpa oleh data HP lain.
export async function terapkanDariLuar(rows) {
  let n = 0;
  await db.tx(['produk', 'mutasi', 'penjualan', 'masuk', 'pengeluaran', 'sesi'], async (api) => {
    for (const { store, data } of rows) {
      if (!data || !data.id) continue;
      if (store === 'mutasi') {
        if (await api.get('mutasi', data.id)) continue;
        api.put('mutasi', data);
        const p = await api.get('produk', data.produkId);
        if (p) { p.stok = Math.round(((p.stok || 0) + data.qty) * 1000) / 1000; api.put('produk', p); state.produk.set(p.id, p); }
        n++; // produk belum ada: stoknya dihitung dari semua mutasi saat produk tiba
      } else if (store === 'produk') {
        const lama = await api.get('produk', data.id);
        if (lama && lama.diubah >= data.diubah) continue;
        let stok = lama ? lama.stok : 0;
        if (!lama) { // produk baru dari HP lain: stok = jumlah semua mutasi yang sudah ada
          const ms = await api.idx('mutasi', 'produkId', data.id);
          stok = Math.round(ms.reduce((s, m) => s + m.qty, 0) * 1000) / 1000;
        }
        const p = { ...data, stok };
        api.put('produk', p); state.produk.set(p.id, p); n++;
      } else if (['penjualan', 'masuk', 'pengeluaran', 'sesi'].includes(store)) {
        const lama = await api.get(store, data.id);
        if (lama && lama.diubah >= data.diubah) continue;
        api.put(store, data); n++;
      }
    }
  });
  if (n) emit('remote');
  return n;
}
