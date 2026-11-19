# Laporan QA — 18–19 November 2026 (versi 2)

## Cara pengujian (semuanya benar-benar dijalankan)
- **Alur lengkap** `tests/e2e_flow.py`: Chrome headless, emulasi HP (360×780, DPR 2, layar sentuh, id-ID, Asia/Makassar). Langkahnya: setup shift pagi + data contoh → mulai shift (kas Rp50.000) → transaksi campuran Nasi + Warung → tombol Back menutup sheet → bayar 50rb → ketengan rokok 3 batang → barang lain (validasi) → scan mode ketik (ketemu & tidak ketemu) → daftarkan barang baru dari scan → bayar dengan numpad → batalkan → Hari Ini → Barang → detail → barang masuk → barang keluar → pengeluaran (termasuk pengalihan belanja stok) → riwayat → laporan → tutup shift → lainnya/pengaturan/salinan.
- **Overflow horizontal** di 13 layar × 6 lebar (360, 375, 390, 412, 768, 1280), ditambah detail & form untuk 23 barang di 4 lebar HP (`tests/overflow_products.py`).
- **Sinkronisasi dua HP** `tests/sync_two_phones.py` melawan **Code.gs asli** yang dijalankan di emulator Node (`tests/gas-emulator.mjs`, batas tab dibuat 12 baris supaya penambahan baris ikut teruji).
- **Spreadsheet template** di Google Sheets sungguhan: nilai Dashboard dibaca ulang lewat API dan dicocokkan dengan hitungan manual; tampilan diperiksa dari ekspor PDF.
- **Kontras warna** dihitung dengan rumus WCAG dari nilai token.
- Console error & page error dicatat sepanjang alur.

## Hasil
| Pemeriksaan | Hasil |
|---|---|
| Alur lengkap + overflow | **91/91 lulus**, 0 console error |
| Overflow halaman barang (23 barang × detail/ubah × 4 lebar) | 0 |
| Sinkronisasi dua HP (Code.gs asli di emulator) | **8/8 lulus**, termasuk kiriman ulang identik ditolak sebagai duplikat (1 → 0) |
| Code.gs: tab penuh | 15 penjualan sekaligus ke tab berkapasitas 12 baris → tab ditambah 500 baris, semua tertulis |
| Code.gs: `hapusDataContoh` | baris `c002` terhapus, 15 baris asli tetap |
| Dashboard Google Sheets (data contoh 12–18 Nov) | Penjualan Rp861.800 = Nasi 406.000 + Warung 455.800; per hari Nasi 92+16+98+53+67+50+30 = 406 rb ✓; laba 861.800 − 381.325 − 325.000 = Rp155.475 ✓; filter Lapak "Warung" → laba Rp9.475 ✓ |
| Sinkronisasi dua HP (versi lama, server tiruan) | **7/7 lulus**: kirim semua, kirim ulang tidak ganda (5→5 baris), HP baru memulihkan stok 8, jual bersamaan di dua HP → stok 4 di keduanya, harga dari HP siang sampai tanpa menimpa stok, batal di HP pagi mengembalikan stok di HP siang, kode salah ditolak |
| Total & kembalian | 2×10.000 + 5.000 = 25.000; ditambah 1 = 35.000; bayar 50.000 → kembalian 15.000 |
| Nominal cepat (total 35.000) | Uang pas, 40rb, 50rb, 100rb |
| Ketengan | Jual 3 batang → stok 120 → 117; tampil "9 bungkus + 9 batang" |
| Tutup shift (dicek manual dari layar) | 50.000 + 30.000 + 12.500 − 22.000 − 24.600 = **45.900**; Nasi 8.000, setor ke Ibu 37.900 ✓ |
| Kontras teks | terendah 5,20:1 (teks muted di latar), semua ≥ 4,5:1 |

## Bug yang ditemukan dan diperbaiki
| # | Temuan | Perbaikan |
|---|---|---|
| 1 | Tombol simpan yang menempel di bawah menutupi isian terakhir ketika isian itu digulir ke tampilan | `scroll-padding-bottom: 104px` (base.css) |
| 2 | Form Tambah barang melebar 16 px di layar 360 (tombol "Juga dijual per bungkus/dus/ketengan?" tidak bisa turun baris) | Label dipendekkan; tombol boleh turun baris |
| 3 | Detail barang melebar 38 px (Barang masuk + Barang keluar berdampingan) | `.btn` boleh turun baris, `min-width: 0` |
| 4 | Efek hover tertinggal setelah disentuh di HP (tombol "Batalkan" tampak berlatar) | Semua `:hover` dipindah ke `@media (hover: hover)` |
| 5 | Titik penanda lapak tertutup badge jumlah di tile | Penanda diganti garis tegak di tepi kiri tile |
| 6 | Tombol kurang di keranjang berubah jadi ikon hapus, padahal ada tombol "Hapus" juga | Jumlah minimal 1; menghapus hanya lewat tombol berlabel |
| 7 | Teks bantuan ganda di Tutup shift | Satu teks bantuan |
| 8 | Barang harian (nasi) kembali 0 setelah tutup shift, dan tidak ada tempat jelas untuk mengisi stok pagi | Sheet "Mulai shift pagi" sekarang berisi "Yang dibuat hari ini" |
| 9 | Placeholder kolom angka memakai huruf slab besar | Placeholder memakai font UI |
| 10 | Link status salinan bergaris bawah | `text-decoration: none` |
| 11 | **Code.gs menggandakan baris Log** saat kiriman yang sama diulang: Sheets mengubah teks `diubah` menjadi Date, sehingga kunci tidak pernah cocok (ditemukan oleh emulator) | Kunci disimpan sebagai satu teks `store\|id\|diubah` di kolom E |
| 12 | `siapkan()` lama menghapus tab Ringkasan setiap dijalankan | `siapkan()` sekarang tidak menghapus apa pun; Dashboard ada di template |
| 13 | Tabel per hari di Dashboard berisi angka sama setiap hari (SUMIFS di dalam ARRAYFORMULA tidak menghitung per baris) | Satu rumus SUMIFS per baris |
| 14 | Judul Dashboard terpotong di ekspor PDF | Sel judul memakai *overflow* |
| 15 | Tab tampilan bisa penuh (1000 baris) lalu Code.gs gagal menulis | `pastikanMuat()` menambah baris + memperpanjang banding |

Pelajaran dari QA versi 1 yang ikut diterapkan: tombol Back menutup sheet, toast tidak menutupi kolom cari (dipindah ke atas bar keranjang), dan nominal cepat yang masuk akal.

## Belum diuji (jujur)
- **HP fisik.** Kamera, senter, getar, bip, BarcodeDetector, "Tambahkan ke layar utama", service worker (butuh HTTPS), dan mode pesawat perlu dicoba di HP Samsung dengan Chrome.
- **Apps Script di server Google.** Code.gs sudah dijalankan di emulator, tapi belum di-deploy di Google: menempel skrip dan memberi izin harus dilakukan pemilik akun keluarga. Spreadsheet template sudah ada di Google dan Dashboard-nya teruji, tapi belum pernah menerima kiriman langsung dari aplikasi.
- **TalkBack** belum dicoba. Label, `aria-*`, peran dialog, dan urutan fokus sudah dipasang.
- **Uji pengguna** dengan istri pakde dan ibu pakde: target ≤ 5 ketukan sudah terukur di skrip, tapi kenyamanan sungguhan hanya bisa dilihat di warung.
