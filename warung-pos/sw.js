// Service worker: menyimpan file aplikasi supaya tetap terbuka tanpa sinyal.
// Naikkan VERSI setiap kali file aplikasi diubah, supaya HP mengambil versi baru.
const VERSI = 'warung-pos-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/components.css', './css/screens.css',
  './assets/fonts/fira-400.woff', './assets/fonts/fira-500.woff', './assets/fonts/fira-600.woff', './assets/fonts/bitter.woff',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './js/app.js', './js/ui.js', './js/db.js', './js/store.js', './js/sync.js', './js/format.js', './js/scanner.js', './js/seed.js',
  './js/screens/kasir.js', './js/screens/transaksi.js', './js/screens/hari-ini.js', './js/screens/barang.js', './js/screens/produk-form.js',
  './js/screens/stok.js', './js/screens/pengeluaran.js', './js/screens/riwayat.js', './js/screens/laporan.js', './js/screens/tutup.js',
  './js/screens/lainnya.js', './js/screens/setup.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSI).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSI).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Apps Script tidak di-cache
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(VERSI).then((c) => c.put(e.request, copy)); return res;
  })));
});
