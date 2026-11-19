// Kerangka aplikasi: router hash, navigasi bawah, status salinan, boot.
import { h, icon, closeAllSheets } from './ui.js';
import { state, init, onChange } from './store.js';
import * as sync from './sync.js';
import { jam } from './format.js';

import { kasirScreen } from './screens/kasir.js';
import { hariIniScreen } from './screens/hari-ini.js';
import { barangScreen, produkDetailScreen } from './screens/barang.js';
import { produkFormScreen } from './screens/produk-form.js';
import { masukScreen, keluarScreen } from './screens/stok.js';
import { pengeluaranScreen, pengeluaranFormScreen } from './screens/pengeluaran.js';
import { riwayatScreen } from './screens/riwayat.js';
import { laporanScreen } from './screens/laporan.js';
import { tutupScreen } from './screens/tutup.js';
import { lainnyaScreen, pengaturanScreen, salinanScreen } from './screens/lainnya.js';
import { setupScreen } from './screens/setup.js';

const routes = [
  ['/kasir', kasirScreen, { tab: 'kasir' }],
  ['/hari-ini', hariIniScreen, { tab: 'hari-ini' }],
  ['/barang', barangScreen, { tab: 'barang' }],
  ['/lainnya', lainnyaScreen, { tab: 'lainnya' }],
  ['/produk/baru', produkFormScreen, { form: true }],
  ['/produk/:id', produkDetailScreen, { form: true }],
  ['/produk/:id/ubah', produkFormScreen, { form: true }],
  ['/masuk', masukScreen, { form: true }],
  ['/keluar', keluarScreen, { form: true }],
  ['/pengeluaran', pengeluaranScreen, { tab: 'lainnya' }],
  ['/pengeluaran/baru', pengeluaranFormScreen, { form: true }],
  ['/riwayat', riwayatScreen, { tab: 'lainnya' }],
  ['/laporan', laporanScreen, { tab: 'lainnya' }],
  ['/tutup', tutupScreen, { form: true }],
  ['/pengaturan', pengaturanScreen, { form: true }],
  ['/salinan', salinanScreen, { tab: 'lainnya' }],
  ['/setup', setupScreen, { setup: true }],
];

function match(path) {
  for (const [pat, fn, opt] of routes) {
    const a = pat.split('/'), b = path.split('/');
    if (a.length !== b.length) continue;
    const params = {};
    if (a.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { fn, opt, params };
  }
  return null;
}

const NAV = [['kasir', 'Kasir', 'kasir'], ['hari-ini', 'Hari Ini', 'hari'], ['barang', 'Barang', 'barang'], ['lainnya', 'Lainnya', 'lainnya']];
function bottomNav(active) {
  return h('nav', { class: 'bottom-nav', 'aria-label': 'Menu utama' },
    NAV.map(([id, label, ic]) => h('a', { class: 'nav-item', href: '#/' + id, 'aria-current': active === id ? 'page' : null }, icon(ic), label)));
}

// Status salinan ke Google, dipakai di header layar utama
export function syncBadge() {
  const el = h('a', { class: 'sync-status', href: '#/salinan', 'aria-label': 'Status salinan ke Google' });
  const render = (s) => {
    el.className = 'sync-status ' + ({ ok: '', pending: 'pending', off: 'off', offline: 'pending', error: 'error' }[s.mode] || '');
    const t = s.mode === 'off' ? 'Belum tersambung'
      : s.mode === 'offline' ? (s.pending ? `${s.pending} menunggu sinyal` : 'Tanpa sinyal')
      : s.mode === 'error' ? 'Gagal menyalin'
      : s.pending ? `${s.pending} belum tersalin`
      : s.terakhir ? `Tersimpan ${jam(s.terakhir)}` : 'Tersambung';
    el.replaceChildren(h('span', { class: 'dot' }), t);
  };
  cleanups.push(sync.onStatus(render)); // dilepas saat pindah layar
  return el;
}

let cleanups = [];
const root = document.getElementById('app');

export function go(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }

async function render() {
  cleanups.forEach((f) => f()); cleanups = [];
  closeAllSheets();
  const [path, qs] = (location.hash.replace(/^#/, '') || '/kasir').split('?');
  if (!state.device && path !== '/setup') { location.replace('#/setup'); return; }
  const m = match(path) || match('/kasir');
  const ctx = { params: m.params, query: Object.fromEntries(new URLSearchParams(qs || '')), go, onCleanup: (f) => cleanups.push(f), syncBadge };
  const main = h('main', { class: ['app-main', !m.opt.tab && 'no-nav'], id: 'main' });
  const screen = await m.fn(ctx);
  main.append(screen.node || screen);
  if (screen.cartbar) main.classList.add('has-cartbar');
  root.replaceChildren(main, m.opt.tab ? bottomNav(m.opt.tab) : '');
  if (screen.after) screen.after();
  window.scrollTo(0, 0);
  if (m.opt.tab) document.querySelectorAll('.nav-item').forEach((a) => a.addEventListener('click', () => { if (a.getAttribute('href') === location.hash) render(); }));
  const t = main.querySelector('h1, .header-title');
  document.title = (t ? t.textContent + ' · ' : '') + (state.settings?.namaWarung || 'Warung');
}
export const rerender = render;

async function boot() {
  await init();
  window.addEventListener('hashchange', render);
  // Data dari HP lain bisa mengubah layar yang sedang terbuka (mis. stok). Muat ulang hanya layar daftar, bukan form.
  onChange((what) => {
    if (what !== 'remote') { sync.jadwalkan(1500); return; } // perubahan lokal → kirim salinan sebentar lagi
    if (document.querySelector('.sheet, .modal, .scanner')) return;
    const p = location.hash.replace(/^#/, '');
    if (p === '/hari-ini' || p === '/barang' || p === '/riwayat') render();
  });
  await render();
  sync.mulai();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
boot().catch((e) => {
  root.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'alert alert-danger' }, icon('alert'), h('div', null, h('strong', null, 'Aplikasi gagal dibuka. '), h('p', null, 'Tutup lalu buka lagi. Kalau masih gagal, pastikan memakai Chrome versi terbaru.'), h('p', { class: 'muted' }, String(e.message || e))))));
  console.error(e);
});
