// Pembungkus IndexedDB tanpa dependensi. Satu database per HP.
const NAME = 'warung-pos';
const VERSION = 1;
export const STORES = ['meta', 'produk', 'penjualan', 'mutasi', 'masuk', 'pengeluaran', 'sesi', 'outbox'];

let dbp;
export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('meta', { keyPath: 'key' });
      const p = db.createObjectStore('produk', { keyPath: 'id' }); p.createIndex('pemilik', 'pemilik');
      const j = db.createObjectStore('penjualan', { keyPath: 'id' }); j.createIndex('tanggal', 'tanggal');
      const m = db.createObjectStore('mutasi', { keyPath: 'id' }); m.createIndex('produkId', 'produkId');
      const bm = db.createObjectStore('masuk', { keyPath: 'id' }); bm.createIndex('tanggal', 'tanggal');
      const pg = db.createObjectStore('pengeluaran', { keyPath: 'id' }); pg.createIndex('tanggal', 'tanggal');
      const s = db.createObjectStore('sesi', { keyPath: 'id' }); s.createIndex('tanggal', 'tanggal');
      db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const prom = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function get(store, key) { const db = await openDB(); return prom(db.transaction(store).objectStore(store).get(key)); }
export async function getAll(store) { const db = await openDB(); return prom(db.transaction(store).objectStore(store).getAll()); }
export async function byIndex(store, index, value) { const db = await openDB(); return prom(db.transaction(store).objectStore(store).index(index).getAll(value)); }
export async function range(store, index, lo, hi) { const db = await openDB(); return prom(db.transaction(store).objectStore(store).index(index).getAll(IDBKeyRange.bound(lo, hi))); }
export async function count(store) { const db = await openDB(); return prom(db.transaction(store).objectStore(store).count()); }

// Transaksi atomik: fn menerima objek { get, put, del, add } untuk store-store yang diminta.
// Semua berhasil atau semua batal.
export async function tx(stores, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    const os = (s) => t.objectStore(s);
    const api = {
      get: (s, k) => prom(os(s).get(k)),
      put: (s, v) => os(s).put(v),
      add: (s, v) => os(s).add(v),
      del: (s, k) => os(s).delete(k),
      idx: (s, index, v) => prom(os(s).index(index).getAll(v)),
    };
    let result;
    Promise.resolve(fn(api)).then((r) => { result = r; }, (e) => { try { t.abort(); } catch {} reject(e); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksi dibatalkan'));
  });
}

export async function getMeta(key, fallback = null) { const r = await get('meta', key); return r ? r.value : fallback; }
export async function setMeta(key, value) { const db = await openDB(); return prom(db.transaction('meta', 'readwrite').objectStore('meta').put({ key, value })); }

export async function clearAll() {
  const db = await openDB();
  await new Promise((res, rej) => { const t = db.transaction(STORES, 'readwrite'); STORES.forEach((s) => t.objectStore(s).clear()); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
