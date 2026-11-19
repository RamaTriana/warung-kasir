// Format angka, uang, tanggal, dan satuan. Semua uang = bilangan bulat rupiah.

export const rupiah = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
export const angka = (n) => (Math.round((n || 0) * 1000) / 1000).toLocaleString('id-ID');
export const ribuan = (n) => (n % 1000 === 0 ? (n / 1000) + 'rb' : rupiah(n));

// Parse input pengguna: "25.000", "25000", "25rb" → 25000
export function parseRupiah(s) {
  if (typeof s === 'number') return Math.round(s);
  const t = String(s || '').toLowerCase().replace(/\s/g, '');
  if (!t) return 0;
  const rb = t.endsWith('rb') || t.endsWith('k');
  const digits = t.replace(/[^0-9]/g, '');
  const n = parseInt(digits || '0', 10);
  return rb ? n * 1000 : n;
}
export function parseQty(s) {
  const n = parseFloat(String(s || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const TZ = 'Asia/Makassar';
const dFmt = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export function tanggalKey(iso) { // YYYY-MM-DD menurut WITA
  const p = Object.fromEntries(dFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const hariIniKey = () => tanggalKey(new Date().toISOString());
export function geserHari(key, n) {
  const d = new Date(key + 'T12:00:00+08:00');
  d.setUTCDate(d.getUTCDate() + n);
  return tanggalKey(d.toISOString());
}
export const jam = (iso) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace(':', '.');
export const tanggalPendek = (key) => new Date(key + 'T12:00:00+08:00').toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const tanggalPanjang = (key) => new Date(key + 'T12:00:00+08:00').toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export function salam() {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

// Stok dalam satuan dasar → teks yang mudah dibaca, mis. "2 bks + 5 btg"
export function teksStok(produk) {
  if (!produk || produk.modeStok === 'tanpa') return 'tanpa stok';
  const s = produk.stok || 0;
  const dasar = produk.satuanDasar || 'pcs';
  const besar = (produk.satuan || []).filter((u) => u.isi > 1).sort((a, b) => b.isi - a.isi)[0];
  if (besar && Math.abs(s) >= besar.isi) {
    const neg = s < 0 ? '−' : '';
    const a = Math.abs(s);
    const b = Math.floor(a / besar.isi);
    const sisa = Math.round((a - b * besar.isi) * 1000) / 1000;
    return `${neg}${b} ${besar.nama}` + (sisa ? ` + ${angka(sisa)} ${dasar}` : '');
  }
  return `${angka(s)} ${dasar}`;
}
export function statusStok(p) {
  if (!p || p.modeStok === 'tanpa') return 'none';
  if ((p.stok || 0) <= 0) return 'out';
  if (p.stokMin && p.stok <= p.stokMin) return 'low';
  return 'ok';
}
export const LABEL_STOK = { ok: 'Stok', low: 'Menipis', out: 'Habis', none: '' };

export const LAPAK = { nasi: 'Nasi', warung: 'Warung' };
export const SHIFT = { pagi: 'Pagi', siang: 'Siang' };
