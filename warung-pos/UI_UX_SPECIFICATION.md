# Spesifikasi UI/UX — Warung POS

Sumber kebutuhan: SRS.md (ringkasan dari dokumen SRS di Claude). Layar ditulis dengan urutan prioritas. Tangkapan layar hasil QA ada di `tests/shots/` setelah `npm run test:e2e`.

## Arsitektur informasi

```
Navigasi bawah (4 tab, ikon + label)
├── Kasir            ← halaman pertama setiap kali aplikasi dibuka
│   ├── sheet Mulai shift (uang laci + yang dibuat hari ini)
│   ├── sheet Pilih satuan (ketengan)
│   ├── sheet Barang lain (harga diketik)
│   ├── Scanner (layar penuh) → sheet Barcode belum terdaftar → Tambah barang
│   ├── sheet Keranjang → sheet Pembayaran (layar penuh) → sheet Transaksi tersimpan
├── Hari Ini         ← ringkasan + daftar transaksi hari ini → sheet Detail transaksi
├── Barang           ← daftar + saringan → Detail barang → Ubah barang
│   ├── Barang masuk
│   └── Barang keluar / hitung ulang
└── Lainnya
    ├── Tutup shift
    ├── Pengeluaran → Catat pengeluaran
    ├── Riwayat transaksi
    ├── Laporan
    ├── Salinan ke Google
    └── Pengaturan
Setup (sekali per HP, sebelum semua di atas)
```

**Keputusan yang berbeda dari brief:**
- Brief menulis Dashboard sebagai halaman pembuka. Untuk penjual, halaman pembuka adalah **Kasir**, karena 90% pembukaan aplikasi adalah untuk mencatat jualan. Dashboard menjadi tab "Hari Ini".
- Tidak ada pemilihan shift setiap membuka aplikasi. Setiap HP disetel sekali (HP istri pakde = pagi, HP ibu = siang), sehingga risiko salah shift hilang. Ganti shift hanya lewat Pengaturan, dan ditolak bila shift masih berjalan.
- Kategori pengeluaran "Belanja stok" dari brief tidak menyimpan pengeluaran. Kategori itu membuka penjelasan dan tombol ke **Barang masuk**, supaya laba tidak dihitung dua kali (SRS §8).
- Ekspor lengkap lewat Google Sheets; di aplikasi hanya ada unduhan CSV per periode (Laporan) dan cadangan JSON (Pengaturan).

## Alur utama (jumlah ketukan diukur di QA)

| # | Alur | Langkah | Ketukan |
|---|---|---|---|
| F1 | Membuka sistem | Buka ikon di layar utama → Kasir (sudah ada pita shift, nama penjaga, status salinan) | 1 |
| F2 | Memulai shift | Otomatis saat Kasir pertama dibuka hari itu: isi uang laci (+ jumlah nasi dibuat, shift pagi) → Mulai jualan | 2–3 |
| F3 | Transaksi tanpa barcode (nasi kuning ×2, bayar 50rb) | tile ×2 → bar keranjang → Bayar → "50rb" → Simpan → Transaksi baru | 7 (5 tanpa membuka keranjang: tile ×2, Bayar, nominal, Simpan) |
| F4 | Transaksi barcode | Scan → arahkan (barang masuk keranjang, scanner tetap terbuka untuk barang berikutnya) → Selesai scan → Bayar → Uang pas → Simpan | 5 + scan |
| F5 | Barcode tidak ditemukan | Scan → sheet: Daftarkan / Cari nama / Jual sebagai barang lain / Scan lagi | 1 |
| F6 | Tambah barang | Daftarkan (barcode terisi) → nama + harga → Simpan → **kembali ke kasir dan langsung masuk keranjang** | — |
| F7 | Barang masuk | Barang → Barang masuk → cari/scan → satuan (default kemasan terbesar) → jumlah → harga beli (terisi dari modal) → dari laci? → Simpan. Stok sebelum → sesudah selalu tampil | — |
| F8 | Barang keluar | Barang keluar → barang → alasan (Rusak/basi, Kedaluwarsa, Dipakai sendiri, Hilang, Hitung ulang) → jumlah → konfirmasi | — |
| F9 | Pengeluaran | Untuk apa? → nominal → milik Nasi/Warung → dari laci → Simpan | 4 + angka |
| F10 | Laporan | Periode (hari ini / 7 hari / bulan ini / bulan lalu) → lapak → shift → ringkasan, per hari, paling laku → Unduh | — |
| F11 | Tutup shift | Ringkasan uang → hitung uang laci → selisih langsung tampil → sisa nasi → pembagian Nasi / serahkan ke Ibu → Tutup | — |

Semua alur di atas dibutuhkan untuk MVP, kecuali F4/F5 (scanner) yang menurut SRS masuk Fase 2. Scanner tetap dibuat sekarang karena pemakaiannya pendek dan berisiko teknis tertinggi, jadi perlu dicoba di HP sungguhan sedini mungkin.

## Spesifikasi per layar

### A. Kasir (`js/screens/kasir.js`)
1. **Tujuan:** mencatat penjualan secepat menghitung di kepala. 2. **Pengguna:** kedua penjaga.
3. **Info utama:** barang + harga, isi keranjang, total.
4. **Layout:** header (pita shift 4 px, "Kasir", "Shift pagi · Bu Sri", status salinan) → kolom cari + tombol scan 56 px → chip kategori (geser) → grid tile (2 kolom < 384 px, 3 kolom ≥ 384 px) → tile "Barang lain" di akhir → bar keranjang melayang di atas navigasi.
5. **Hierarki:** harga (Bitter 20) > nama (16/500) > satuan/stok (13). Penanda pemilik = garis tegak kunyit/nila di tepi kiri tile.
6. **Komponen:** search, chip, tile, cart bar, sheet, qty control, numpad, toast.
7. **Interaksi:** ketuk tile = +1 (badge jumlah muncul). Barang dengan beberapa satuan membuka sheet "Pilih satuan". Barang yang tercatat habis tetap bisa dijual, dengan toast peringatan (stok yang salah tidak boleh menghalangi jualan). Kolom cari menerima input scanner Bluetooth: angka ≥ 6 digit + Enter dianggap barcode.
8. **Responsif:** satu kolom maksimum 560 px di tengah pada tablet/desktop.
9. **Empty:** "Belum ada barang" + Tambah barang. Pencarian kosong: "'x' tidak ada" + "Jual sebagai barang lain".
10. **Loading:** tidak ada (data sudah di memori).
11. **Error:** toast merah bila penyimpanan gagal; keranjang tidak dikosongkan.
12. **Data:** produk aktif kedua lapak (shift pagi: Nasi dulu, siang: Warung dulu).
13. **Aksi:** pilih, cari, scan, barang lain, buka keranjang.

### B–F. Keranjang → Pembayaran → Berhasil
- **Keranjang (sheet):** per baris nama, tag lapak, harga/satuan, subtotal, qty control (min 1), tombol "Hapus" berlabel. Bila keranjang berisi dua lapak, tampil rincian Nasi/Warung. Footer: total (Bitter 28) + "Bayar Rp…" + "Kosongkan keranjang" (dengan konfirmasi).
- **Pembayaran (layar penuh):** Total belanja (40) → Uang diterima (40, abu bila 0) → Kembalian (hijau) atau "Kurang Rp…" (merah) → nominal cepat (Uang pas + 3 pecahan berikutnya yang masuk akal, mis. total 35rb → 40rb, 50rb, 100rb) → numpad (1–9, 000, 0, hapus). "Simpan transaksi" nonaktif sampai uang cukup.
- **Berhasil (sheet):** nomor transaksi + "tersimpan di HP", **Kembalian** paling besar (angka yang harus diucapkan ke pembeli), total & dibayar, rincian dapat dibuka. Aksi: "Transaksi baru" (fokus otomatis), "Batalkan transaksi ini" (alasan wajib). Tidak ada cetak struk (tidak ada printer; di luar SRS).

### C. Scanner (`js/scanner.js`)
Kamera belakang layar penuh, bingkai scan dengan garis kunyit, tombol senter (hanya bila HP mendukung), tutup, "Cari nama", "Ketik angka", "Selesai scan". Mode terus-menerus: setiap barang yang ketemu masuk keranjang, muncul kartu "Nama (satuan) +1 · n barang dipindai". Barcode yang sama diabaikan selama 1,5 detik. Bila BarcodeDetector tidak tersedia (bukan Chrome Android/Play Services): peringatan yang jelas + kolom ketik yang juga berfungsi untuk scanner Bluetooth. Izin kamera ditolak: petunjuk membuka pengaturan izin situs.

### G–H. Barang & Tambah/Ubah barang
- **Daftar:** Barang masuk / Barang keluar di atas, cari nama atau barcode, chip Semua / Menipis / Habis / Nasi / Warung / Disembunyikan (dengan jumlah). Baris: nama, lapak, kategori, satuan; kanan: harga + status stok. Tidak ada tabel.
- **Detail:** stok besar ("9 bungkus + 9 batang"), tombol masuk/keluar, harga per satuan + barcode, modal, riwayat stok 25 terakhir (+ hijau / − merah), "Sembunyikan dari kasir" (pengganti hapus; riwayat tetap ada).
- **Form:** Nama (wajib) · Milik Nasi/Warung (wajib) · Kategori (chip + ketik baru, boleh kosong) · Cara hitung stok (Dihitung / Harian / Tanpa stok, dengan penjelasan) · Satuan terkecil + harga (wajib) + barcode (scan/ketik, boleh kosong) · Satuan lain: nama, isi, harga, barcode · Modal per satuan terkecil (boleh kosong; petunjuk khusus untuk masakan sendiri) · Stok awal & batas pengingat · Favorit. Validasi saat simpan: nama, nama satuan, harga > 0, isi > 0 dan ≠ 1, barcode unik. Pesan di bawah isian + fokus ke isian pertama yang salah.

### I–K. Stok, Barang masuk, Barang keluar
Lihat F7/F8. Stok tidak pernah diedit langsung; selalu lewat mutasi berjenis dan beralasan. Hitung ulang meminta "jumlah sebenarnya", lalu aplikasi mencatat selisihnya.

### L. Pengeluaran
Daftar per periode + total; ketuk untuk detail & batalkan. Form maksimal 5 isian: kategori (Bahan baku, Gas, Listrik, Transportasi, Operasional, Lainnya), nominal, milik, dari laci (default ya), catatan.

### M. Riwayat transaksi
Cari nomor/barang, chip Hari ini / Kemarin / 7 hari / Pilih tanggal, chip shift. Dikelompokkan per tanggal dengan jumlah dan total harian. Item batal dicoret + badge. Detail: pembatalan hanya di HP yang mencatat (supaya stok tidak dikembalikan dua kali).

### N. Laporan
Penjualan (40) + jumlah transaksi & batal, modal terjual, pengeluaran, **estimasi laba** (dengan rumus tertulis), peringatan bila ada barang tanpa modal, penjelasan "Beda penjualan, laba, dan uang kas". Per shift, per lapak, per hari (bar sederhana), 10 paling laku (bar berwarna lapak). Tidak ada grafik dekoratif. Unduh CSV.

### Hari Ini (dashboard)
Sapaan + status shift → penjualan hari ini (40) → grid Nasi / Warung / Pengeluaran / Estimasi laba → Tutup shift + Pengeluaran → per shift → stok menipis (5 teratas) → transaksi hari ini (8 terakhir). Skeleton saat memuat.

### O. Pengaturan & Salinan ke Google
Nama warung, nama penjaga, shift HP ini, kategori per lapak, unduh cadangan JSON, hapus semua data (dua konfirmasi, harus mengetik HAPUS). Salinan: status (tersimpan / menunggu / tanpa sinyal / gagal / belum tersambung), kirim & ambil sekarang, alamat + kode + tes, pulihkan.

## State global

| State | Tampilan |
|---|---|
| Tanpa sinyal | Status "n menunggu sinyal" (oranye). Semua fitur tetap jalan |
| Gagal menyalin | Status merah + pesan di Salinan ke Google; data aman di HP |
| Loading | Skeleton (Hari Ini, Laporan); spinner di tombol yang sedang menyimpan |
| Disabled | Opasitas 45% + `disabled` asli (tombol Simpan transaksi saat uang kurang) |
| Error isian | Garis merah + pesan di bawah isian + `role="alert"` |
