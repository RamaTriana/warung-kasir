// Salinan ke Google Sheets lewat Apps Script (apps-script/Code.gs).
// Kirim: isi outbox → POST (Content-Type text/plain, supaya tidak ada preflight CORS).
// Ambil: GET ?aksi=ambil&sejak=<nomor baris> → catatan dari HP lain → store.terapkanDariLuar.
// Aman diulang: server melewati ID+versi yang sudah ada; HP menerapkan mutasi tepat sekali.
import * as db from './db.js';
import { terapkanDariLuar, state } from './store.js';

export const status = { mode: 'off', pending: 0, terakhir: null, pesan: '' };
const subs = new Set();
export const onStatus = (fn) => { subs.add(fn); fn(status); return () => subs.delete(fn); };
const tell = () => subs.forEach((fn) => fn(status));

let running = false;
let timer = null;

export async function konfigurasi() { return db.getMeta('sync', null); }
export async function simpanKonfigurasi(cfg) { await db.setMeta('sync', cfg); await db.setMeta('syncCursor', 0); jadwalkan(100); }

async function hitungPending() { status.pending = await db.count('outbox'); }

export async function jalankan() {
  if (running) return;
  const cfg = await konfigurasi();
  await hitungPending();
  status.terakhir = await db.getMeta('syncTerakhir');
  if (!cfg || !cfg.url) { status.mode = 'off'; tell(); return; }
  if (!navigator.onLine) { status.mode = 'offline'; tell(); return; }
  running = true;
  try {
    // 1. Kirim
    const items = (await db.getAll('outbox')).slice(0, 200);
    if (items.length) {
      const res = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ aksi: 'kirim', kode: cfg.kode, device: state.device.id, items: items.map(({ store, id, data }) => ({ store, id, data })) }) });
      const out = await res.json();
      if (!out.ok) throw new Error(out.pesan || 'Ditolak server');
      await db.tx(['outbox'], (api) => { items.forEach((i) => api.del('outbox', i.seq)); });
    }
    // 2. Ambil dari HP lain
    let sejak = await db.getMeta('syncCursor', 0);
    for (let putaran = 0; putaran < 20; putaran++) {
      const u = new URL(cfg.url);
      u.searchParams.set('aksi', 'ambil'); u.searchParams.set('kode', cfg.kode); u.searchParams.set('device', state.device.id); u.searchParams.set('sejak', sejak);
      const res = await fetch(u.toString());
      const out = await res.json();
      if (!out.ok) throw new Error(out.pesan || 'Ditolak server');
      if (out.rows.length) await terapkanDariLuar(out.rows);
      sejak = out.sampai; await db.setMeta('syncCursor', sejak);
      if (!out.lagi) break;
    }
    status.terakhir = new Date().toISOString();
    await db.setMeta('syncTerakhir', status.terakhir);
    await hitungPending();
    status.mode = status.pending ? 'pending' : 'ok'; status.pesan = '';
  } catch (e) {
    await hitungPending();
    status.mode = 'error'; status.pesan = e.message || String(e);
  } finally {
    running = false; tell();
    if (status.pending && status.mode !== 'error') jadwalkan(1500);
  }
}

export function jadwalkan(ms = 2000) { clearTimeout(timer); timer = setTimeout(jalankan, ms); }

export function mulai() {
  jadwalkan(800);
  setInterval(jalankan, 60_000);
  window.addEventListener('online', () => jadwalkan(300));
  window.addEventListener('offline', () => { status.mode = 'offline'; tell(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) jadwalkan(300); });
}

// Pulihkan HP baru: ambil semua catatan (termasuk milik HP ini sebelumnya)
export async function pulihkan(cfg, deviceId) {
  let sejak = 0, total = 0;
  for (let i = 0; i < 200; i++) {
    const u = new URL(cfg.url);
    u.searchParams.set('aksi', 'ambil'); u.searchParams.set('kode', cfg.kode); u.searchParams.set('device', '__semua__'); u.searchParams.set('sejak', sejak);
    const out = await (await fetch(u.toString())).json();
    if (!out.ok) throw new Error(out.pesan || 'Ditolak server');
    total += await terapkanDariLuar(out.rows);
    sejak = out.sampai;
    if (!out.lagi) break;
  }
  await db.setMeta('syncCursor', sejak);
  return total;
}

export async function tesKoneksi(cfg) {
  const u = new URL(cfg.url); u.searchParams.set('aksi', 'tes'); u.searchParams.set('kode', cfg.kode);
  const out = await (await fetch(u.toString())).json();
  if (!out.ok) throw new Error(out.pesan || 'Kode salah');
  return out;
}
