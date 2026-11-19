/**
 * Warung POS — penerima salinan data di Google Sheets milik keluarga.
 *
 * Cara pasang (lihat juga IMPLEMENTATION_NOTES.md bagian "Serah terima"):
 * 1. Buka spreadsheet template "Warung — Data Kasir" → File → Buat salinan (di akun Google keluarga)
 *    → di salinan itu: Ekstensi → Apps Script.
 * 2. Hapus isi Code.gs, tempel seluruh file ini, simpan.
 * 3. Jalankan fungsi `siapkan` sekali (izinkan akses). Fungsi ini membuat kode rahasia dan tab yang belum ada.
 *    Tidak menghapus apa pun. Setelah yakin, jalankan `hapusDataContoh` untuk membuang baris contoh.
 * 4. Deploy → Deployment baru → Jenis: Aplikasi web → Jalankan sebagai: Saya → Akses: Siapa saja.
 * 5. Salin URL aplikasi web + kode rahasia (Tab "Pengaturan", sel B2) ke aplikasi kasir di setiap HP.
 *
 * Protokol (dipakai js/sync.js):
 *   POST  body {aksi:'kirim', kode, device, items:[{store,id,data}]}      → {ok, diterima}
 *   GET   ?aksi=ambil&kode=&device=&sejak=<nomor baris>                   → {ok, rows, sampai, lagi}
 *   GET   ?aksi=tes&kode=                                                  → {ok, nama}
 * Data mentah disimpan di tab "Log" (jangan diedit). Tab lain hanya tampilan untuk dibaca manusia.
 */

const TAB_LOG = 'Log';
const BATAS_AMBIL = 400;
const TZ = 'Asia/Makassar';

const JUDUL = {
  'Penjualan': ['Tanggal', 'Jam', 'No', 'Shift', 'Penjaga', 'Total', 'Dibayar', 'Kembalian', 'Status', 'Alasan batal', 'ID'],
  'Barang Terjual': ['Tanggal', 'No', 'Shift', 'Lapak', 'Barang', 'Satuan', 'Jumlah', 'Harga', 'Subtotal', 'Modal/satuan', 'Status', 'ID penjualan'],
  'Pengeluaran': ['Tanggal', 'Jam', 'Lapak', 'Kategori', 'Nominal', 'Dari laci', 'Catatan', 'Status', 'ID'],
  'Barang Masuk': ['Tanggal', 'Jam', 'Lapak', 'Barang', 'Satuan', 'Jumlah', 'Harga beli', 'Pemasok', 'Dari laci', 'ID'],
  'Mutasi Stok': ['Tanggal', 'Jam', 'Lapak', 'Barang', 'Jenis', 'Jumlah (satuan dasar)', 'Alasan', 'Oleh', 'ID'],
  'Produk': ['ID', 'Lapak', 'Nama', 'Kategori', 'Satuan dasar', 'Satuan jual', 'Modal/satuan dasar', 'Mode stok', 'Aktif', 'Diubah'],
  'Shift': ['Tanggal', 'Shift', 'Penjaga', 'Dibuka', 'Ditutup', 'Kas awal', 'Kas seharusnya', 'Kas dihitung', 'Selisih', 'Setor Nasi', 'Setor Warung', 'ID'],
};
// Kolom ID per tab (1 = kolom A). Dipakai untuk mencari baris dan menghapus data contoh.
const KOLOM_ID = { 'Penjualan': 11, 'Barang Terjual': 12, 'Pengeluaran': 9, 'Barang Masuk': 10, 'Mutasi Stok': 9, 'Produk': 1, 'Shift': 12 };

/**
 * Jalankan sekali setelah menempel skrip. Aman dijalankan ulang:
 * tidak menghapus data, tidak mengubah tab Dashboard atau tampilan yang sudah ada.
 */
function siapkan() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('KODE')) props.setProperty('KODE', Utilities.getUuid().slice(0, 8).toUpperCase());
  Object.keys(JUDUL).forEach((name) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, JUDUL[name].length).setValues([JUDUL[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  const log = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
  if (log.getLastRow() === 0) { log.appendRow(['Waktu server', 'Device', 'Store', 'ID', 'Kunci (store|id|versi)', 'Data (JSON)']); log.setFrozenRows(1); }
  if (!log.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) log.protect().setWarningOnly(true).setDescription('Data mentah aplikasi kasir. Jangan diedit.');
  const atur = ss.getSheetByName('Pengaturan') || ss.insertSheet('Pengaturan');
  atur.getRange('A1').setValue('Pengaturan');
  atur.getRange('A2:B2').setValues([['Kode rahasia', props.getProperty('KODE')]]);
  if (!atur.getRange('B3').getValue()) atur.getRange('A3:B3').setValues([['Alamat aplikasi', 'Tempel di sini URL aplikasi web setelah Deploy (supaya tidak hilang).']]);
  ['Sheet1', 'Lembar1'].forEach((n) => { const s = ss.getSheetByName(n); if (s && ss.getSheets().length > 1) ss.deleteSheet(s); });
  return props.getProperty('KODE');
}

/** Menghapus baris contoh (ID diawali "c0") dari tab tampilan. Tab Log tidak disentuh. */
function hapusDataContoh() {
  const ss = SpreadsheetApp.getActive();
  let jumlah = 0;
  Object.keys(KOLOM_ID).forEach((name) => {
    const sh = ss.getSheetByName(name); if (!sh) return;
    const last = barisAkhir(sh); if (last < 2) return;
    const ids = sh.getRange(2, KOLOM_ID[name], last - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (/^c0/.test(String(ids[i][0]))) { sh.deleteRow(i + 2); jumlah++; }
    }
  });
  return jumlah + ' baris contoh dihapus';
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function kodeBenar(k) { return k && k === PropertiesService.getScriptProperties().getProperty('KODE'); }

function doGet(e) {
  const p = e.parameter || {};
  if (!kodeBenar(p.kode)) return json({ ok: false, pesan: 'Kode salah' });
  if (p.aksi === 'tes') return json({ ok: true, nama: SpreadsheetApp.getActive().getName() });
  if (p.aksi === 'ambil') {
    const log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
    const last = log.getLastRow();
    const sejak = Math.max(1, Number(p.sejak) || 1); // baris 1 = judul
    if (last <= sejak) return json({ ok: true, rows: [], sampai: sejak, lagi: false });
    const n = Math.min(last - sejak, BATAS_AMBIL);
    const vals = log.getRange(sejak + 1, 1, n, 6).getValues();
    const rows = [];
    vals.forEach((v) => { if (p.device === '__semua__' || v[1] !== p.device) { try { rows.push({ store: v[2], id: v[3], data: JSON.parse(v[5]) }); } catch (err) {} } });
    return json({ ok: true, rows: rows, sampai: sejak + n, lagi: sejak + n < last });
  }
  return json({ ok: false, pesan: 'Aksi tidak dikenal' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, pesan: 'Format salah' }); }
  if (!kodeBenar(body.kode)) return json({ ok: false, pesan: 'Kode salah' });
  if (body.aksi !== 'kirim') return json({ ok: false, pesan: 'Aksi tidak dikenal' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const log = ss.getSheetByName(TAB_LOG);
    const last = log.getLastRow();
    const ada = new Set();
    // Kunci disimpan sebagai satu teks berisi '|' supaya Google Sheets tidak mengubahnya menjadi tanggal/angka.
    // (Versi sebelumnya membaca kolom 'diubah' terpisah; Sheets mengubahnya jadi Date sehingga kiriman ulang tercatat ganda.)
    if (last > 1) log.getRange(2, 5, last - 1, 1).getValues().forEach((v) => ada.add(String(v[0])));
    const baru = [];
    const now = new Date();
    (body.items || []).forEach((it) => {
      const d = it.data || {};
      const key = it.store + '|' + it.id + '|' + (d.diubah || d.waktu || '');
      if (ada.has(key)) return;
      ada.add(key);
      baru.push([now, String(body.device), String(it.store), String(it.id), key, JSON.stringify(d)]);
      try { tampilkan(ss, it.store, d); } catch (err) { console.error(err); }
    });
    if (baru.length) { pastikanMuat(log, log.getLastRow() + baru.length); log.getRange(log.getLastRow() + 1, 1, baru.length, 6).setValues(baru); }
    return json({ ok: true, diterima: baru.length });
  } finally { lock.releaseLock(); }
}

// ---- Tab yang mudah dibaca manusia --------------------------------------
function tgl(iso) { return Utilities.formatDate(new Date(iso), TZ, 'yyyy-MM-dd'); }
function jam(iso) { return Utilities.formatDate(new Date(iso), TZ, 'HH:mm'); }
// Baris terakhir yang berisi data di kolom A. Tidak memakai getLastRow() karena
// tab "Barang Terjual" punya rumus ARRAYFORMULA di kolom M yang bisa ikut terhitung.
function barisAkhir(sh) {
  const max = sh.getMaxRows();
  const vals = sh.getRange(1, 1, max, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i][0] !== '' && vals[i][0] !== null) return i + 1;
  return 0;
}
// Tambah baris kosong bila tab hampir penuh, lalu perpanjang warna selang-seling (banding).
function pastikanMuat(sh, sampaiBaris) {
  const max = sh.getMaxRows();
  if (sampaiBaris <= max) return;
  const tambah = Math.max(sampaiBaris - max, 500);
  sh.insertRowsAfter(max, tambah);
  sh.getBandings().forEach((b) => { const r = b.getRange(); b.setRange(sh.getRange(r.getRow(), r.getColumn(), sh.getMaxRows() - r.getRow() + 1, r.getNumColumns())); });
}
function tulisBaris(sh, rows) {
  if (!rows.length) return;
  const mulai = barisAkhir(sh) + 1;
  pastikanMuat(sh, mulai + rows.length - 1);
  sh.getRange(mulai, 1, rows.length, rows[0].length).setValues(rows);
}
function cariBaris(sh, kolom, nilai) {
  const last = barisAkhir(sh); if (last < 2) return 0;
  const vals = sh.getRange(2, kolom, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === String(nilai)) return i + 2;
  return 0;
}
function upsert(sh, kolomId, id, row) {
  const r = cariBaris(sh, kolomId, id);
  if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else tulisBaris(sh, [row]);
}
function tampilkan(ss, store, d) {
  if (store === 'penjualan') {
    upsert(ss.getSheetByName('Penjualan'), 11, d.id, [tgl(d.waktu), jam(d.waktu), d.no, d.shift, d.penjaga, d.total, d.dibayar, d.kembalian, d.status, d.alasanBatal || '', d.id]);
    const sh = ss.getSheetByName('Barang Terjual');
    if (d.status === 'batal') {
      const last = barisAkhir(sh);
      if (last > 1) { const v = sh.getRange(2, 12, last - 1, 1).getValues(); v.forEach((x, i) => { if (String(x[0]) === String(d.id)) sh.getRange(i + 2, 11).setValue('batal'); }); }
    } else if (!cariBaris(sh, 12, d.id)) {
      const rows = d.items.map((it) => [tgl(d.waktu), d.no, d.shift, it.pemilik, it.nama, it.satuan, it.qty, it.harga, it.subtotal, it.modal, d.status, d.id]);
      tulisBaris(sh, rows);
    }
  } else if (store === 'pengeluaran') {
    upsert(ss.getSheetByName('Pengeluaran'), 9, d.id, [tgl(d.waktu), jam(d.waktu), d.pemilik, d.kategori, d.nominal, d.dariLaci ? 'ya' : 'tidak', d.catatan, d.status, d.id]);
  } else if (store === 'masuk') {
    const sh = ss.getSheetByName('Barang Masuk');
    if (!cariBaris(sh, 10, d.id)) tulisBaris(sh, d.items.map((it) => [tgl(d.waktu), jam(d.waktu), it.pemilik, it.nama, it.satuan, it.qty, it.hargaBeli, d.pemasok, d.dariLaci ? 'ya' : 'tidak', d.id]));
  } else if (store === 'mutasi') {
    if (d.jenis === 'jual' || d.jenis === 'batal_jual') return; // sudah terlihat di tab penjualan
    upsert(ss.getSheetByName('Mutasi Stok'), 9, d.id, [tgl(d.waktu), jam(d.waktu), d.pemilik, d.nama, d.jenis, d.qty, d.alasan || '', d.oleh || '', d.id]);
  } else if (store === 'produk') {
    const satuan = (d.satuan || []).map((u) => u.nama + (u.isi > 1 ? ' (isi ' + u.isi + ')' : '') + ' Rp' + u.harga).join('; ');
    upsert(ss.getSheetByName('Produk'), 1, d.id, [d.id, d.pemilik, d.nama, d.kategori, d.satuanDasar, satuan, d.modalPerDasar, d.modeStok, d.aktif ? 'ya' : 'tidak', d.diubah]);
  } else if (store === 'sesi') {
    const s = d.setor || {};
    upsert(ss.getSheetByName('Shift'), 12, d.id, [d.tanggal, d.shift, d.penjaga, d.dibuka ? jam(d.dibuka) : '', d.ditutup ? jam(d.ditutup) : '', d.kasAwal || 0, d.kasSeharusnya || '', d.kasDihitung == null ? '' : d.kasDihitung, d.selisih == null ? '' : d.selisih, s.nasi || '', s.warung || '', d.id]);
  }
}
