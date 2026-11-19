# SRS ringkas — Warung POS

Dokumen lengkap (analisis, alternatif teknologi, risiko) ada di dokumen Claude "Warung POS — Analisis Kebutuhan & Rancangan Awal". File ini adalah versi ringkas yang menjadi acuan desain dan kode, dan nomor KF/KNF-nya dipakai di DESIGN_IMPLEMENTATION_MAPPING.md.

## Konteks
- **Lapak (pemilik uang & barang):** Nasi (istri pakde) dan Warung (ibu pakde). Uangnya dipisah.
- **Shift (penjaga):** Pagi = istri pakde, menjual Nasi **dan** barang Warung. Siang = ibu pakde, menjual Warung. Masing-masing memakai HP Android sendiri.
- Volume 10–30 transaksi per hari. Ada penjualan ketengan. Tidak ada bon. Belum memakai QRIS. Internet dari kuota HP.
- Developer membuat sekali lalu menyerahkan. Tidak ada yang merawat server; data milik keluarga.

## Arsitektur
PWA local-first (HTML/CSS/JS, tanpa build) → IndexedDB di setiap HP sebagai database utama → salinan dua arah ke Google Sheets milik akun Google keluarga lewat Apps Script. Hosting statis (Cloudflare Pages / GitHub Pages). Biaya Rp0.

## Kebutuhan fungsional
| ID | Kebutuhan |
|---|---|
| KF-01 | Setup HP sekali: nama penjaga, shift, sambungan Google, data awal |
| KF-02 | Mulai & tutup shift: kas awal, kas dihitung, selisih, pembagian uang per lapak (setor ke Ibu) |
| KF-03 | Kasir tunai: pilih/cari, keranjang, uang diterima, kembalian |
| KF-04 | Barang lain (harga diketik) untuk barang belum terdaftar |
| KF-05 | Produk dengan satuan jual ganda (ketengan) dan mode stok dihitung/harian/tanpa |
| KF-06 | Stok hanya berubah lewat mutasi berjenis; riwayat stok |
| KF-07 | Riwayat transaksi & pembatalan beralasan (tanpa hapus) |
| KF-08 | Ringkasan Hari Ini per lapak dan per shift |
| KF-09 | Salinan ke Google Sheets, sinkron dua HP, pemulihan HP baru |
| KF-10 | Scan barcode kamera + daftar barang dari hasil scan |
| KF-11 | Barang masuk (per kemasan → satuan dasar), memperbarui modal |
| KF-12 | Barang keluar: rusak, kedaluwarsa, dipakai sendiri, hilang, hitung ulang |
| KF-13 | Pengeluaran operasional per lapak (belanja dagangan diarahkan ke Barang masuk) |
| KF-14 | Laporan periode: omzet, modal, pengeluaran, estimasi laba, per hari/shift/lapak, terlaris, unduh |

## Kebutuhan nonfungsional
| ID | Kriteria |
|---|---|
| KNF-01 | Penjualan sederhana ≤ 5 ketukan, < 10 detik |
| KNF-02 | Semua fitur jalan tanpa sinyal |
| KNF-03 | Kirim ulang tidak menggandakan data |
| KNF-04 | Uang bilangan bulat rupiah |
| KNF-05 | Tidak ada hapus permanen dari aplikasi (batal/sembunyikan) |
| KNF-06 | Teks ≥ 16 px (keterangan ≥ 13), angka uang ≥ 28 px di layar bayar, sentuh ≥ 48 px, kontras ≥ 4,5:1 |
| KNF-07 | HP baru bisa memulihkan data dari Sheets |
| KNF-08 | Tanpa layanan yang ter-pause/kedaluwarsa (tanpa domain sendiri, tanpa server berbayar) |

## Rumus
- Kas seharusnya = kas awal + penjualan − pengeluaran dari laci − belanja barang dari laci.
- Setor ke Ibu (shift pagi) = kas awal + penjualan Warung − pengeluaran Warung dari laci − belanja Warung dari laci. Uang Nasi = penjualan Nasi − pengeluaran Nasi dari laci − belanja Nasi dari laci.
- Estimasi laba = Σ(qty × (harga − modal snapshot)) − pengeluaran operasional. Masakan sendiri: modal 0, bahan dicatat sebagai pengeluaran "Bahan baku".
