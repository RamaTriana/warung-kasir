# Catatan implementasi

## Menjalankan di komputer
```
python3 -m http.server 8080        # buka http://localhost:8080
node tests/mock-apps-script.mjs    # opsional: Google Sheets tiruan di :8099, kode TES12345
```
Tidak ada `npm install`. Tes memakai Python Playwright + Chrome (`pip install playwright`).

## Struktur
```
index.html, manifest.webmanifest, sw.js   PWA (sw aktif hanya di HTTPS)
css/tokens.css      semua token desain
css/base.css        reset, tipografi, kerangka
css/components.css  komponen (padanan js/ui.js)
css/screens.css     sisa gaya khusus layar
js/app.js           router hash, navigasi bawah, status salinan, boot
js/ui.js            h(), ikon, tombol, field, sheet, dialog, toast, numpad, lapisan Back
js/db.js            IndexedDB tanpa dependensi, transaksi atomik
js/store.js         logika bisnis: jual, batal, mutasi, sesi, laporan, gabung data HP lain
js/sync.js          kirim outbox / ambil dari Apps Script, pulihkan
js/scanner.js       BarcodeDetector + mode ketik/scanner Bluetooth
js/format.js        rupiah, tanggal WITA, teks stok "2 bks + 5 btg"
js/seed.js          data contoh (barcode contoh, bukan barcode asli)
js/screens/*.js     satu file per layar
apps-script/Code.gs penerima di Google Sheets keluarga
tests/              e2e, sinkron dua HP, overflow, server tiruan
_arsip-v1/          sisa versi 1 (tidak bisa dijalankan; boleh dihapus)
```

## Keputusan teknis
- **Tanpa React/Vite/npm.** Sistem ini akan ditinggal tanpa perawatan. Tanpa dependensi berarti tidak ada paket yang usang atau rusak, dan deploy cukup mengunggah folder.
- **IndexedDB = database utama.** Setiap simpanan ditulis dalam satu transaksi bersama baris `outbox`. Kalau datanya tersimpan, antrean kirimnya juga pasti tersimpan.
- **Penggabungan dua HP.** Log append-only di Sheets. Mutasi diterapkan tepat sekali menurut UUID. Catatan lain memakai `diubah` terbaru. Stok lokal tidak pernah ditimpa data dari HP lain; produk yang baru datang menghitung stoknya dari semua mutasi yang sudah ada.
- **Apps Script.** POST memakai `text/plain` supaya browser tidak mengirim preflight CORS. Penulisan dikunci dengan `LockService`. Kunci dedup = satu teks `store|id|diubah` di kolom E tab Log (teks ber-`|` tidak diubah Sheets menjadi tanggal).
- **Tab tampilan & Dashboard.** Code.gs hanya menulis baris (tidak pernah `clear()`), jadi format, banding, dan rumus template tetap. Baris berikutnya dicari dari kolom A (bukan `getLastRow()`, karena kolom M "Modal total" di Barang Terjual berisi ARRAYFORMULA). Bila tab penuh, ditambah 500 baris dan banding diperpanjang. Dashboard membaca seluruh kolom dengan SUMIFS/QUERY, jadi tidak perlu diubah saat data bertambah.
- **Locale spreadsheet `in_ID`.** Rumus ditulis dengan pemisah `,` lewat API saat locale `en_US`, lalu locale dikembalikan ke `in_ID`; Sheets menyimpan rumus secara netral, di layar tampil dengan `;`.
- **Emulator Apps Script** `tests/gas-emulator.mjs` menjalankan Code.gs asli di Node dengan tiruan SpreadsheetApp (termasuk konversi teks→tanggal/angka seperti Sheets, batas jumlah baris tab, `EMU_MAXROWS` untuk menguji penambahan baris). Endpoint uji: `/_sheets`, `/_log`, `/_run?fn=siapkan|hapusDataContoh`, `/_seedContoh`.
- **Tombol Back Android.** Satu entri history "penjaga" dipakai bersama oleh sheet, dialog, dan scanner. Back menutup lapisan paling atas.
- **Scanner.** `BarcodeDetector` bawaan Chrome Android, yang butuh Google Play Services. Polyfill ZXing-WASM **tidak disertakan**, karena workspace ini tidak punya akses jaringan ke npm. Akibatnya, di browser tanpa API itu scanner memakai mode ketik, yang juga dipakai scanner Bluetooth. Kalau ingin polyfill, unduh paket `barcode-detector` dan muat dengan `import()` di `scanner.js` sebelum `kameraDidukung()`.
- **Font.** Fira Sans + Bitter, OFL, di-subset ke WOFF dan disimpan sendiri, tanpa CDN.
- **Waktu.** Semua tanggal laporan memakai zona Asia/Makassar (WITA), bukan zona HP.

## Serah terima (yang harus dilakukan manusia)
1. **Buat akun Google keluarga.** Buka accounts.google.com → Buat akun → Untuk diri sendiri. Pakai nomor HP pakde sebagai nomor pemulihan. Catat email & password di kertas panduan. (Claude tidak bisa membuat akun Google.)
2. **Google Sheets (template sudah jadi).** Template "Warung — Data Kasir" sudah dibuat lengkap dengan Dashboard (kartu angka, 3 grafik, filter tanggal & lapak), 7 tab data berformat, dan data contoh 12–18 Nov 2026: https://docs.google.com/spreadsheets/d/1Tu4D1GnN5tms8SpK-8jcaBKo6qfVLCxTOnZ1kjtFD_w/edit
   - Masuk dengan akun keluarga → buka template → **File → Buat salinan** (salinan otomatis milik akun keluarga).
   - Di salinan: **Ekstensi → Apps Script** → hapus isi `Code.gs` → tempel `apps-script/Code.gs` → Simpan.
   - Pilih fungsi `siapkan` → **Jalankan** → izinkan akses. Kode rahasia muncul di tab Pengaturan, sel B2. `siapkan` aman diulang: tidak menghapus data, tidak menyentuh Dashboard.
   - **Deploy → Deployment baru** → jenis Aplikasi web, Jalankan sebagai: Saya, Akses: Siapa saja → salin URL, tempel juga di Pengaturan B3.
   - Setelah yakin tersambung, jalankan `hapusDataContoh` (menghapus baris yang ID-nya diawali `c0`). Dashboard tetap bekerja dengan data asli.
   - Kalau template ini disalin sebelum skrip ditempel, skripnya memang belum ada: Google tidak mengizinkan skrip dipasang dari luar tanpa persetujuan pemilik akun.
3. **Hosting.** Buat akun Cloudflare dengan email keluarga → Workers & Pages → Create → Pages → Upload assets → unggah isi folder ini (tanpa `tests/` dan `_arsip-v1/`). Hasilnya alamat `https://<nama>.pages.dev`. GitHub Pages juga bisa. Jangan beli domain.
4. **Setiap HP.** Buka alamat itu **di Chrome** (bukan Samsung Internet) → menu ⋮ → Tambahkan ke layar utama. Setup: nama, shift, alamat Apps Script + kode. HP pertama: "Mulai kosong", lalu isi barang. HP kedua: "Ambil dari Google Sheets".
5. **Uji sebelum ditinggal:** satu transaksi di masing-masing HP, cek baris muncul di Sheets, mode pesawat → jual → nyalakan lagi → baris muncul. Lalu pulihkan di HP ketiga atau browser lain.
6. Cetak panduan 1 halaman: membuka aplikasi, tanda oranye/merah, HP rusak → pulihkan, email & password akun Google.

## Kalau mengubah file aplikasi
Naikkan `VERSI` di `sw.js`, supaya HP yang sudah memasang aplikasi mengambil versi baru.
