# Pemetaan SRS → Desain → Kode

Status: ✅ dibuat & diuji otomatis · 🟡 dibuat, perlu dicoba di HP fisik · ⏸ sengaja tidak dibuat (alasan ditulis)

| SRS | Layar (UI_UX_SPECIFICATION.md) | Komponen | File implementasi | Uji | Status |
|---|---|---|---|---|---|
| KF-01 Setup | Setup 3 langkah | choice, field | `js/screens/setup.js`, `js/store.js` (simpanDevice) | e2e: setup pagi & siang | ✅ |
| KF-02 Mulai shift | Sheet Mulai shift (+ yang dibuat hari ini) | sheet, moneyInput, qtyControl | `kasir.js` mulaiShiftSheet, `store.js` bukaSesi | e2e | ✅ |
| KF-02 Tutup shift & setor | Tutup shift | kv, alert selisih, stat-grid setor | `screens/tutup.js`, `store.js` rekapSesi/tutupSesi | e2e (45.900 / 8.000 / 37.900 dicek manual) | ✅ |
| KF-03 Kasir | Kasir, Keranjang, Pembayaran, Berhasil | tile, cart-bar, sheet, numpad, price | `screens/kasir.js`, `store.js` jual | e2e: total, kembalian, nominal cepat | ✅ |
| KF-04 Barang lain | Sheet Barang lain | moneyInput, segmented | `kasir.js` manualSheet | e2e: validasi harga | ✅ |
| KF-05 Produk & ketengan | Form barang, Pilih satuan | card satuan, chip | `screens/produk-form.js`, `format.js` teksStok | e2e: jual 3 batang → stok −3 | ✅ |
| KF-06 Mutasi & riwayat stok | Detail barang | list riwayat | `screens/barang.js`, `store.js` terapkanMutasi | e2e | ✅ |
| KF-07 Riwayat & batal | Riwayat, Detail transaksi | transaksiItem, confirmDialog | `screens/riwayat.js`, `screens/transaksi.js`, `store.js` batalkan | e2e + uji sinkron (batal kembali ke HP lain) | ✅ |
| KF-08 Hari Ini | Hari Ini | stat-grid, list | `screens/hari-ini.js`, `store.js` laporan | e2e | ✅ |
| KF-09 Salinan & sinkron | Salinan ke Google, status di header | syncBadge, alert | `js/sync.js`, `store.js` terapkanDariLuar, `apps-script/Code.gs` | `tests/sync_two_phones.py` (Code.gs asli di emulator) 8/8 | 🟡 Apps Script belum di-deploy di akun keluarga |
| KF-14b Ekspor ke Google Sheets | Dashboard spreadsheet (palet Papan Harga: kertas, nila, kunyit; Fira Sans + Bitter) | kartu KPI, grafik batang bertumpuk per hari, 10 terlaris, per lapak, filter tanggal/lapak | template Google Sheets + `apps-script/Code.gs` (`tampilkan`, `tulisBaris`) | nilai dicek lewat API + ekspor PDF | ✅ template; 🟡 belum tersambung ke HP |
| KF-10 Scanner | Scanner, Barcode belum terdaftar | scanner overlay | `js/scanner.js`, `kasir.js` scan/barcodeBaru | e2e mode ketik | 🟡 kamera perlu HP fisik |
| KF-11 Barang masuk | Barang masuk | pemilih barang, qty, moneyInput | `screens/stok.js` masukScreen, `store.js` barangMasuk | e2e | ✅ |
| KF-12 Barang keluar | Barang keluar | chip alasan, pratinjau stok | `screens/stok.js` keluarScreen | e2e | ✅ |
| KF-13 Pengeluaran | Pengeluaran, Catat pengeluaran | chip, segmented | `screens/pengeluaran.js` | e2e (termasuk pengalihan belanja stok) | ✅ |
| KF-14 Laporan & unduh | Laporan | stat-grid, bar-row | `screens/laporan.js` (unduhCSV) | e2e tampilan | ✅ (unduhan dicek manual di HP) |
| KNF-01 ≤ 5 ketukan | Kasir | — | — | F3: 5 ketukan tanpa membuka keranjang | ✅ |
| KNF-02 Offline | semua | — | `sw.js`, IndexedDB | service worker hanya aktif di HTTPS | 🟡 cek di HP: mode pesawat |
| KNF-03 Tidak ganda | — | — | UUID + dedup di `Code.gs` & `store.js` | sync test | ✅ |
| KNF-05 Tanpa hapus | Detail barang, transaksi, pengeluaran | — | status batal / aktif=false | e2e | ✅ |
| KNF-06 Keterbacaan | semua | tokens | `css/tokens.css` | kontras 5,2–15,3 : 1, overflow 0 di 360–1280 | ✅ |
| KNF-07 Pulihkan | Setup langkah 3, Salinan | — | `sync.js` pulihkan | sync test (HP siang memulihkan) | ✅ (server tiruan) |
| KNF-08 Tanpa perawatan | — | — | tanpa dependensi npm, tanpa build | — | ✅ |
| Brief: pembayaran non-tunai | — | — | kolom `metode` selalu "tunai" | — | ⏸ QRIS belum dipakai |
| Brief: cetak/share struk | — | — | — | — | ⏸ tidak ada printer; layar berhasil menampilkan nomor & rincian |
| Brief: pilih shift saat membuka | — | — | shift disetel per HP di Setup/Pengaturan | — | ⏸ diganti, lihat UI_UX_SPECIFICATION.md |
| Brief: tablet/desktop layout khusus | — | — | satu kolom 560 px di tengah | overflow 768/1280 | ⏸ disengaja: dipakai di HP |
| Brief: Figma | — | — | — | — | ⏸ belum dibuat; prototipe = aplikasi berjalan. Bisa diimpor ke Figma kalau diminta |

Tidak ada fitur di UI tanpa baris di tabel ini.
