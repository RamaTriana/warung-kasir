// Menjalankan apps-script/Code.gs ASLI di Node dengan tiruan layanan Google Apps Script,
// lalu melayaninya lewat HTTP dengan protokol yang sama seperti aplikasi web Apps Script.
// Meniru juga perilaku Google Sheets yang sering menjebak: teks yang mirip tanggal/angka
// otomatis diubah menjadi Date/Number saat ditulis dengan setValues/appendRow.
//
// Jalankan: node tests/gas-emulator.mjs [port=8099]   (kode rahasia: TES12345)
// Cek isi sheet: GET /_sheets
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';

const MAX_ROWS = Number(process.env.EMU_MAXROWS || 1000);
const autoConvert = (v) => {
  if (typeof v !== 'string') return v;
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v)) return new Date(v);
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v);
  return v;
};

class Range {
  constructor(sheet, r, c, nr = 1, nc = 1) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.sheet.rows[this.r - 1 + i] || []; const o = []; for (let j = 0; j < this.nc; j++) o.push(row[this.c - 1 + j] ?? ''); out.push(o); } return out; }
  setValues(vals) {
    if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error(`Ukuran data ${vals.length}x${vals[0].length} tidak cocok dengan range ${this.nr}x${this.nc}`);
    vals.forEach((row, i) => row.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, v))); return this;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) { this.sheet.set(this.r, this.c, v); return this; }
  setFormula(f) { this.sheet.set(this.r, this.c, f, true); return this; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.protected = false; this.maxRows = MAX_ROWS; this.bandings = []; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(after, n) { this.maxRows += n; this.inserted = (this.inserted || 0) + n; return this; }
  getBandings() { return this.bandings; }
  getProtections() { return this.protected ? [{}] : []; }
  deleteRow(r) { this.rows.splice(r - 1, 1); return this; }
  set(r, c, v, raw) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c - 1) row.push(''); row[c - 1] = raw ? v : autoConvert(v); }
  getLastRow() { let n = this.rows.length; while (n > 0 && this.rows[n - 1].every((x) => x === '' || x == null)) n--; return n; }
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') {
      const m = r.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      const c0 = m[1].charCodeAt(0) - 64, r0 = Number(m[2]);
      return m[3] ? new Range(this, r0, c0, Number(m[4]) - r0 + 1, m[3].charCodeAt(0) - 64 - c0 + 1) : new Range(this, r0, c0);
    }
    if (r < 1 || c < 1 || (nr ?? 1) < 1) throw new Error(`Range tidak valid (${r},${c},${nr},${nc})`);
    // Seperti Google Sheets: range di luar jumlah baris tab = error.
    if (r + (nr ?? 1) - 1 > this.maxRows) throw new Error(`Range melewati batas tab ${this.name} (${r + (nr ?? 1) - 1} > ${this.maxRows} baris)`);
    return new Range(this, r, c, nr, nc);
  }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, j) => this.set(r, j + 1, v)); return this; }
  setFrozenRows() { return this; }
  clear() { this.rows = []; return this; }
  protect() { const self = this; return { setWarningOnly() { self.protected = true; return this; }, setDescription() { return this; } }; }
  getName() { return this.name; }
}
const ss = { sheets: [new Sheet('Sheet1')], name: 'Warung — Data Kasir (emulator)',
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; },
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; },
  getSheets() { return this.sheets; }, deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }, getName() { return this.name; } };
const props = { KODE: 'TES12345' };
let lockHeld = false;
const pad = (n) => String(n).padStart(2, '0');
const ctx = {
  SpreadsheetApp: { getActive: () => ss, ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() { if (lockHeld) throw new Error('lock dipegang'); lockHeld = true; }, releaseLock() { lockHeld = false; } }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate(d, tz, f) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(d)).map((x) => [x.type, x.value])); return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute); },
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }) },
  console, JSON, Date, Math, Number, String, Set, Object,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx, { filename: 'Code.gs' });
const kode = vm.runInContext('siapkan()', ctx);
console.log('siapkan() selesai, kode =', kode, '| tab:', ss.sheets.map((s) => s.name).join(', '));

const port = Number(process.argv[2] || 8099);
const reply = (res, out) => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(out.getContent()); };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(405); res.end(); return; } // Apps Script tidak melayani preflight
  if (u.pathname === '/_run') { const fn = u.searchParams.get('fn'); if (!['siapkan', 'hapusDataContoh'].includes(fn)) { res.writeHead(400); res.end('fn?'); return; } const out = vm.runInContext(fn + '()', ctx); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ out, maxRows: Object.fromEntries(ss.sheets.map((x) => [x.name, x.maxRows])) })); return; }
  if (u.pathname === '/_seedContoh') { const sh = ss.getSheetByName('Penjualan'); sh.appendRow(['2026-11-12', '06:27', 'P1112-001', 'pagi', 'Bu Sri', 14000, 14000, 0, 'selesai', '', 'c002']); res.writeHead(200); res.end('ok'); return; }
  if (u.pathname === '/_log') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ rows: ss.getSheetByName('Log').getLastRow() - 1 })); return; }
  if (u.pathname === '/_sheets') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(Object.fromEntries(ss.sheets.map((s) => [s.name, s.rows])), null, 1)); return; }
  try {
    if (req.method === 'GET') return reply(res, ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }));
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      if (!/^text\/plain/.test(req.headers['content-type'] || '')) console.warn('PERINGATAN: Content-Type bukan text/plain → di Apps Script asli memicu preflight CORS');
      try { reply(res, ctx.doPost({ postData: { contents: body } })); } catch (e) { console.error('doPost error:', e); res.writeHead(500); res.end(String(e)); }
    });
  } catch (e) { console.error('doGet error:', e); res.writeHead(500); res.end(String(e)); }
}).listen(port, () => console.log('emulator Apps Script di :' + port));
