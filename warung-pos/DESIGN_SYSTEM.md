# Design System — Warung POS ("Papan Harga")

Sumber tunggal: `css/tokens.css`. Komponen: `css/components.css` + pembuatnya di `js/ui.js`. Layar tidak boleh menulis warna, ukuran huruf, atau jarak mentah — selalu `var(--…)`.

## 1. Arah visual

| Arah | Gambaran | Kelebihan | Kekurangan | Keputusan |
|---|---|---|---|---|
| **A. Papan Harga** | Latar kertas hangat, tinta hitam, angka slab seperti papan harga warung, nila untuk aksi, kunyit untuk Nasi | Angka sangat mudah dibaca dari jauh, terasa "warung" tanpa ornamen, tenang dipakai seharian | Identitas bergantung pada tipografi, bukan warna mencolok | **Dipilih** |
| B. Etalase Kaca | Putih bersih, kartu membulat, foto produk | Modern, familiar dari aplikasi belanja | Foto harus dirawat; terlihat seperti template; berat untuk kuota | Ditolak |
| C. Kalkulator Gelap | Latar gelap, satu aksen neon | Angka menonjol | Silau di siang hari, terasa dingin/teknis | Ditolak |

Dipilih berdasarkan kegunaan: **keterbacaan angka** (harga, total, kembalian) dan **makna warna yang konsisten**. Versi 1 proyek ini memakai arah "Buku Nota" (latar abu-kehijauan, biru pulpen); versi 2 mempertahankan prinsipnya tetapi memberi identitas lewat angka slab Bitter dan kertas hangat.

## 2. Warna (semua teks ≥ 4,5:1, diukur di QA_REPORT.md)

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--color-bg` | `#F6F1E7` | Latar halaman (kertas) |
| `--color-surface` / `-elevated` | `#FFFDF8` | Daftar, tile, sheet, input |
| `--color-surface-sunken` | `#EDE6D8` | Segmented, numpad, skeleton |
| `--color-border` / `-strong` | `#DDD3C1` / `#BFB39E` | Garis pemisah / tepi kontrol |
| `--color-text` / `-secondary` / `-muted` | `#1D1B17` / `#4E493F` / `#6B6458` | Teks (15,3 / 7,9 / 5,2 : 1) |
| `--color-primary` (+`-hover` `#263077`, `-pressed` `#1D2563`, `-tint` `#E8EAF5`) | `#2E3A87` nila | Aksi utama, tab aktif, penanda Lapak Warung & shift siang |
| `--color-lapak-nasi` (+`-text` `#7A5300`, `-tint`) | `#E3A51D` kunyit | Penanda Lapak Nasi & shift pagi |
| `--color-success` | `#1C6E45` | Kembalian, kas pas, stok masuk |
| `--color-warning` | `#9A4F04` | Stok menipis, menunggu sinyal |
| `--color-danger` | `#A8231B` | Batal, stok habis, kas kurang, error |
| `--color-info` | `#1F5A86` | Info |

Aturan: kunyit dan nila **hanya** menandai pemilik/shift. Hijau bukan warna utama; hanya status "berhasil". Status selalu disertai teks ("Menipis", "Habis", "Batal").

## 3. Tipografi

- **Fira Sans** (400/500/600) untuk teks antarmuka: humanis, jelas di layar kecil, punya angka tabular.
- **Bitter** (variabel, slab serif) untuk **semua angka uang dan jumlah**: tegas seperti papan harga, angka tabular sehingga digit sejajar.
- Keduanya OFL, di-subset Latin ke `assets/fonts/` (±105 KB total, diunduh sekali lalu di-cache). Tidak memakai Google Fonts CDN (hemat kuota, tidak bergantung layanan luar).

| Peran | Token | Ukuran/tebal |
|---|---|---|
| Total & kembalian | `--text-display-num` | 40 / 600 Bitter |
| Ringkasan | `--text-num-lg` | 28 / 600 Bitter |
| Harga di tile | `--text-num-md` | 20 / 600 Bitter |
| Harga di daftar | `--text-num-sm` | 16 / 600 Bitter |
| Judul halaman | `--text-title` | 22 / 600 |
| Judul sheet/header | `--text-heading` | 18 / 600 |
| Isi | `--text-body` | 16 / 400 (input 17) |
| Label | `--text-label` | 14 / 500 |
| Keterangan | `--text-caption` | 13 / 400 (minimum) |
| Tombol | `--text-button` | 17 / 600 |
| Judul seksi | `--text-overline` | 12 / 600 kapital |

Komponen harga `price()`: "Rp" kecil memakai Fira, angka besar memakai Bitter.

## 4. Jarak, radius, elevasi

- **Jarak** kelipatan 4: `--space-1..8` = 4, 8, 12, 16, 20, 24, 32, 40. Dalam kelompok 8–12, antar-kelompok 16–20, antar-seksi 24.
- **Radius:** 6 (chip, badge), 10 (tombol, input, tile, daftar), 16 (sudut atas sheet & modal). Tidak ada pill penuh.
- **Elevasi:** semua datar dengan garis 1 px. Bayangan **hanya** untuk lapisan melayang: bar keranjang, bottom sheet, modal, toast.
- **Sentuh:** minimum 48 px, tombol utama 56 px, numpad 52 px.

## 5. Ikon

Satu set garis buatan sendiri di `js/ui.js` (`icon()`): 24 px, stroke 1,75, ujung membulat. Navigasi bawah selalu ikon **+ label**. Ikon tanpa label hanya untuk aksi universal (tutup, kembali, hapus) dan selalu punya `aria-label`.

## 6. Komponen (`js/ui.js` ↔ `css/components.css`)

| Komponen | Fungsi | State |
|---|---|---|
| Button (primary/secondary/ghost/danger) | `button()` | default, hover (hanya perangkat ber-mouse), active (skala 0,98), focus-visible (cincin 3 px), disabled (45%), loading (`.is-loading`) |
| Icon button | `iconButton()` | sama |
| Header + pita shift | `header()` | dengan/ tanpa kembali, aksi |
| Bottom navigation | `bottomNav()` di app.js | aktif (`aria-current`) |
| Input, money input, search | `field()`, `moneyInput()` | focus, invalid (`aria-invalid` + pesan), disabled |
| Segmented, choice card, checkbox | `segmented()`, `.choice`, `.check-row` | checked, focus |
| Chip | `chip()` | `aria-pressed` |
| Badge, tag lapak, indikator stok | `lapakTag()`, `stockTag()` | ok / menipis / habis / tanpa stok |
| Tile produk | `tile()` di kasir | di keranjang (cincin nila + jumlah), habis |
| List item, item transaksi | `.list-item`, `transaksiItem()` | ditekan, dibatalkan (dicoret) |
| Quantity control | `qtyControl()` | min tercapai (disabled) |
| Bar keranjang | kasir | muncul bila keranjang berisi |
| Bottom sheet, modal konfirmasi | `sheet()`, `confirmDialog()` | buka/tutup, tombol Back HP menutup |
| Toast, alert | `toast()`, `alertBox()` | success/warning/error/info |
| Empty, skeleton | `empty()`, `skeleton()` | — |
| Numpad | `numpad()` | ditekan |
| Scanner overlay | `bukaScanner()` | kamera, mode ketik, ketemu, tidak ketemu, izin ditolak |
| Indikator shift & salinan | `.shift-pill`, `syncBadge()` | tersimpan / menunggu / tanpa sinyal / gagal / belum tersambung |

## 7. Interaksi

- Transisi 120–200 ms, hanya untuk sheet, toast, tekan tombol. `prefers-reduced-motion` mematikannya.
- Umpan balik scan: bip + getar + nama barang muncul. Gagal: nada rendah + getar ganda.
- Konfirmasi hanya untuk aksi yang tidak bisa diulang (batal transaksi, tutup shift, hapus data, barang keluar).
- Tombol Back Android menutup lapisan paling atas (sheet/dialog/scanner) sebelum berpindah halaman.
