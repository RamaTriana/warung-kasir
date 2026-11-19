// Server tiruan dengan protokol yang sama seperti apps-script/Code.gs, untuk uji sinkronisasi dua HP.
// Jalankan: node tests/mock-apps-script.mjs  (port 8099, kode rahasia TES12345)
import http from 'node:http';
const KODE = 'TES12345';
const log = []; // [device, store, id, diubah, json]
const ada = new Set();
const send = (res, o) => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(o)); };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(400); res.end(); return; } // Apps Script juga tidak melayani preflight
  if (u.pathname === '/_log') return send(res, { rows: log.length });
  if (req.method === 'GET') {
    const p = Object.fromEntries(u.searchParams);
    if (p.kode !== KODE) return send(res, { ok: false, pesan: 'Kode salah' });
    if (p.aksi === 'tes') return send(res, { ok: true, nama: 'Warung (tiruan)' });
    const sejak = Math.max(1, Number(p.sejak) || 1), last = log.length + 1, n = Math.min(last - sejak, 400);
    const rows = log.slice(sejak - 1, sejak - 1 + n).filter((r) => p.device === '__semua__' || r[0] !== p.device).map((r) => ({ store: r[1], id: r[2], data: JSON.parse(r[4]) }));
    return send(res, { ok: true, rows, sampai: sejak + n, lagi: sejak + n < last });
  }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const b = JSON.parse(body);
    if (b.kode !== KODE) return send(res, { ok: false, pesan: 'Kode salah' });
    let n = 0;
    for (const it of b.items) { const d = it.data || {}; const key = `${it.store}|${it.id}|${d.diubah || d.waktu || ''}`; if (ada.has(key)) continue; ada.add(key); log.push([b.device, it.store, it.id, d.diubah || d.waktu || '', JSON.stringify(d)]); n++; }
    send(res, { ok: true, diterima: n });
  });
}).listen(8099, () => console.log('mock apps script :8099'));
