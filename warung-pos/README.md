# Warung POS

Kasir dan catatan stok untuk warung keluarga: Lapak Nasi (pagi) dan Lapak Warung (kelontong). PWA tanpa build dan tanpa dependensi. Data disimpan di setiap HP, lalu disalin otomatis ke Google Sheets milik keluarga.

Template Google Sheets (Dashboard + data contoh): https://docs.google.com/spreadsheets/d/1Tu4D1GnN5tms8SpK-8jcaBKo6qfVLCxTOnZ1kjtFD_w/edit — buat salinan di akun keluarga, lalu ikuti IMPLEMENTATION_NOTES.md bagian "Serah terima".

- Jalankan: `python3 -m http.server 8080`, lalu buka http://localhost:8080 (pilih "Pakai data contoh" untuk mencoba).
- Dokumen: `SRS.md` → `UI_UX_SPECIFICATION.md` → `DESIGN_SYSTEM.md` → `DESIGN_IMPLEMENTATION_MAPPING.md` → `IMPLEMENTATION_NOTES.md` (termasuk langkah serah terima) → `QA_REPORT.md`.
