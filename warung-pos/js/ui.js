// Komponen UI. Setiap fungsi di sini adalah satu komponen di DESIGN_SYSTEM.md.
import { rupiah, teksStok, statusStok, LABEL_STOK, LAPAK } from './format.js';

// ---- h(): pembuat elemen DOM kecil --------------------------------------
export function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'line' || tag === 'polyline'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && 'value' in el) el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') { el[k] = !!v; if (v) el.setAttribute(k, ''); }
      else if (k === 'ref' && typeof v === 'function') v(el);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const frag = (...c) => { const f = document.createDocumentFragment(); append(f, c); return f; };

// ---- Ikon: satu set garis 24px, stroke 1.75 ----------------------------
const ICONS = {
  kasir: 'M4 7h16M4 7l1.5 11h13L20 7M9 7V5a3 3 0 0 1 6 0v2',
  hari: 'M4 19V9m5 10V5m5 14v-7m5 7V7',
  barang: 'M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12l8.5-4M12 12v8',
  lainnya: 'M5 12h.01M12 12h.01M19 12h.01',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 6l6 6-6 6',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3',
  check: 'M5 12.5 10 17l9-10',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.7 2.7L16 9.8',
  alert: 'M12 9v4M12 17h.01M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  flash: 'M13 3 5 13h6l-1 8 8-10h-6z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14h.01',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  cloud: 'M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  cloudOff: 'M3 3l18 18M7 18a4 4 0 0 1-1.6-7.7M9.5 5.6A6 6 0 0 1 18 9a4.5 4.5 0 0 1 2.6 7.6M17.5 18H10',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4z',
  in: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  out: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  box: 'M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12l8.5-4M12 12v8',
};
export function icon(name, cls = '') {
  const svg = h('svg', { class: ['icon', cls], viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.append(h('path', { d: ICONS[name] || ICONS.info }));
  return svg;
}

// ---- Harga ---------------------------------------------------------------
export function price(n, size = 'md') {
  const s = rupiah(n);
  const neg = n < 0;
  return h('span', { class: ['price', `price-${size}`] }, neg ? '−' : '', h('span', { class: 'rp' }, 'Rp'), s.replace('Rp', '').replace('-', ''));
}

// ---- Tag lapak & stok -------------------------------------------------
export const lapakTag = (lapak) => h('span', { class: ['lapak', lapak] }, LAPAK[lapak] || lapak);
export function stockTag(p) {
  const st = statusStok(p);
  if (st === 'none') return h('span', { class: 'stock none' }, 'tanpa stok');
  const label = st === 'ok' ? '' : LABEL_STOK[st] + ' · ';
  return h('span', { class: ['stock', st] }, label + teksStok(p));
}

// ---- Button ------------------------------------------------------------
export function button(label, { variant = 'primary', size, block, icon: ic, onClick, type = 'button', disabled, attrs = {} } = {}) {
  return h('button', { type, class: ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block'], onClick, disabled, ...attrs }, ic ? icon(ic, 'icon-sm') : null, label);
}
export const iconButton = (name, label, onClick, attrs = {}) => h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onClick, ...attrs }, icon(name));

// ---- Header ------------------------------------------------------------
export function header({ title, sub, back, actions = [], shift }) {
  return h('header', { class: 'header' },
    shift ? h('div', { class: ['shift-band', shift] }) : null,
    h('div', { class: ['header-row', back && 'with-back'] },
      back ? iconButton('back', 'Kembali', () => (typeof back === 'function' ? back() : (location.hash = back))) : null,
      h('div', { class: 'header-title' }, title, sub ? h('span', { class: 'header-sub' }, sub) : null),
      ...actions));
}

// ---- Chip & segmented -------------------------------------------------
export function chip(label, pressed, onClick, extra) {
  return h('button', { type: 'button', class: 'chip', 'aria-pressed': pressed ? 'true' : 'false', onClick }, label, extra);
}
export function segmented(name, options, value, onChange) {
  return h('div', { class: 'segmented', role: 'radiogroup' },
    options.map(([val, label]) => h('label', null,
      h('input', { type: 'radio', name, value: val, checked: val === value, onChange: () => onChange(val) }),
      h('span', null, label))));
}

// ---- Field ---------------------------------------------------------------
export function field(label, control, { help, error, optional, id } = {}) {
  const fid = id || 'f' + Math.random().toString(36).slice(2, 8);
  if (control.tagName === 'INPUT' || control.tagName === 'SELECT' || control.tagName === 'TEXTAREA') {
    control.id = fid;
    if (error) control.setAttribute('aria-invalid', 'true');
    if (error || help) control.setAttribute('aria-describedby', fid + '-d');
  } else {
    const inner = control.querySelector('input,select,textarea');
    if (inner) { inner.id = fid; if (error) inner.setAttribute('aria-invalid', 'true'); }
  }
  return h('div', { class: 'field' },
    h('label', { class: 'field-label', for: fid }, label, optional ? h('span', { class: 'opt' }, 'boleh kosong') : null),
    control,
    error ? h('div', { class: 'field-error', id: fid + '-d', role: 'alert' }, error) : help ? h('div', { class: 'field-help', id: fid + '-d' }, help) : null);
}
export function moneyInput(value, onInput, attrs = {}) {
  const inp = h('input', { class: 'input input-num', inputmode: 'numeric', autocomplete: 'off', placeholder: '0', value: value ? Number(value).toLocaleString('id-ID') : '', ...attrs });
  inp.addEventListener('input', () => {
    const digits = inp.value.replace(/[^0-9]/g, '');
    const n = parseInt(digits || '0', 10);
    inp.value = digits ? n.toLocaleString('id-ID') : '';
    onInput(n);
  });
  return h('div', { class: 'input-group' }, h('span', { class: 'prefix' }, 'Rp'), inp);
}

// ---- Quantity control --------------------------------------------------
export function qtyControl(value, onChange, { min = 0, step = 1, label = 'Jumlah' } = {}) {
  const inp = h('input', { type: 'text', inputmode: 'decimal', value: String(value).replace('.', ','), 'aria-label': label });
  const set = (v) => { v = Math.max(min, Math.round(v * 1000) / 1000); inp.value = String(v).replace('.', ','); minus.disabled = v <= min; onChange(v); };
  const minus = h('button', { type: 'button', 'aria-label': 'Kurangi', onClick: () => set(parseFloat(inp.value.replace(',', '.')) - step) }, icon(value <= min + step && min === 0 ? 'trash' : 'minus', 'icon-sm'));
  const plus = h('button', { type: 'button', 'aria-label': 'Tambah', onClick: () => set(parseFloat(inp.value.replace(',', '.')) + step) }, icon('plus', 'icon-sm'));
  inp.addEventListener('change', () => set(parseFloat(inp.value.replace(',', '.')) || 0));
  inp.addEventListener('focus', () => inp.select());
  minus.disabled = value <= min && min > 0;
  return h('div', { class: 'qty' }, minus, inp, plus);
}

// ---- Empty / error state ----------------------------------------------
export function empty({ ic = 'box', title, text, action }) {
  return h('div', { class: 'empty' }, icon(ic), h('div', { class: 'empty-title' }, title), text ? h('p', null, text) : null, action || null);
}
export function alertBox(kind, ic, content) {
  return h('div', { class: ['alert', `alert-${kind}`], role: kind === 'danger' ? 'alert' : 'status' }, icon(ic, 'icon-sm'), h('div', null, content));
}

// ---- Toast --------------------------------------------------------------
let toastWrap;
export function toast(message, { kind = 'success', action, duration = 2600 } = {}) {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap', 'aria-live': 'polite' }); document.body.append(toastWrap); }
  const ic = kind === 'error' ? 'alert' : kind === 'warning' ? 'alert' : 'checkCircle';
  const t = h('div', { class: ['toast', kind], role: kind === 'error' ? 'alert' : 'status' }, icon(ic), h('span', null, message),
    action ? h('button', { type: 'button', onClick: () => { action.onClick(); t.remove(); } }, action.label) : null);
  toastWrap.append(t);
  setTimeout(() => t.remove(), action ? duration + 2400 : duration);
  return t;
}

// ---- Lapisan & tombol Back Android ------------------------------------------
// Setiap lapisan (sheet, dialog, scanner) menambah satu entri history. Tombol Back HP
// menutup lapisan paling atas, bukan keluar dari halaman.
// Satu entri "penjaga" di history dipakai bersama oleh semua lapisan yang terbuka, supaya
// menutup satu sheet lalu membuka sheet berikutnya tidak berebut dengan history.back().
const layers = [];
let skipPops = 0;
let sentinel = false;
function ensureSentinel() { if (!sentinel && layers.length) { history.pushState({ lapisan: true }, ''); sentinel = true; } }
export function pushLayer(onBack) {
  const layer = { onBack };
  layers.push(layer);
  ensureSentinel();
  return function release(mode = 'ui') { // 'ui' = ditutup lewat tombol, 'back' = tombol Back HP, 'nav' = pindah halaman
    const i = layers.indexOf(layer);
    if (i < 0) return;
    layers.splice(i, 1);
    if (mode === 'back') { ensureSentinel(); return; }
    if (mode === 'nav') { sentinel = false; return; }
    setTimeout(() => { if (!layers.length && sentinel) { sentinel = false; skipPops++; history.back(); } }, 0);
  };
}
window.addEventListener('popstate', () => {
  if (skipPops) { skipPops--; return; }
  sentinel = false;
  const top = layers[layers.length - 1];
  if (top) top.onBack();
});

// ---- Bottom sheet -------------------------------------------------------
const openStack = [];
export function sheet({ title, body, foot, full = false, onClose, label }) {
  const scrim = h('div', { class: 'scrim' });
  const closeBtn = iconButton('close', 'Tutup', () => close());
  const panel = h('div', { class: ['sheet', full && 'full'], role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title },
    full ? null : h('div', { class: 'sheet-handle' }),
    h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title' }, title), closeBtn),
    h('div', { class: 'sheet-body' }, body),
    foot ? h('div', { class: 'sheet-foot' }, foot) : null);
  const prevFocus = document.activeElement;
  let closed = false;
  const release = pushLayer(() => close('back'));
  function close(reason) {
    if (closed) return; closed = true;
    release(reason === 'back' ? 'back' : reason === 'nav' ? 'nav' : 'ui');
    panel.classList.remove('open'); scrim.classList.remove('open');
    setTimeout(() => { panel.remove(); scrim.remove(); }, 220);
    const i = openStack.indexOf(api); if (i >= 0) openStack.splice(i, 1);
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    onClose && onClose(reason);
  }
  scrim.addEventListener('click', () => close('scrim'));
  document.body.append(scrim, panel);
  requestAnimationFrame(() => { scrim.classList.add('open'); panel.classList.add('open'); });
  setTimeout(() => (panel.querySelector('[autofocus]') || closeBtn).focus({ preventScroll: true }), 60);
  const api = {
    el: panel, close,
    setBody(b) { const sb = panel.querySelector('.sheet-body'); sb.replaceChildren(b); },
    setFoot(f) { const sf = panel.querySelector('.sheet-foot'); if (sf) sf.replaceChildren(f); },
  };
  openStack.push(api);
  return api;
}
export function closeAllSheets() { [...openStack].forEach((s) => s.close('nav')); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openStack.length) openStack[openStack.length - 1].close('esc'); });

// ---- Konfirmasi (modal kecil) -----------------------------------------
export function confirmDialog({ title, text, ok = 'Ya', cancel = 'Batal', danger = false, input }) {
  return new Promise((resolve) => {
    const scrim = h('div', { class: 'scrim' });
    let inputEl = null;
    if (input) inputEl = h('input', { class: 'input', placeholder: input.placeholder || '', 'aria-label': input.label || title });
    const errEl = h('div', { class: 'field-error', hidden: true }, input?.required ? 'Wajib diisi' : '');
    let selesai = false;
    const release = pushLayer(() => done(inputEl ? null : false, true));
    const done = (v, viaBack = false) => { if (selesai) return; selesai = true; release(viaBack ? 'back' : 'ui'); m.classList.remove('open'); scrim.classList.remove('open'); setTimeout(() => { m.remove(); scrim.remove(); }, 200); resolve(v); };
    const okBtn = button(ok, { variant: danger ? 'danger-solid' : 'primary', onClick: () => {
      if (inputEl) { const v = inputEl.value.trim(); if (input.required && !v) { errEl.hidden = false; inputEl.setAttribute('aria-invalid', 'true'); inputEl.focus(); return; } done(v || ''); } else done(true);
    } });
    const m = h('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', { class: 'modal-title' }, title), text ? h('p', { class: 'secondary' }, text) : null,
      inputEl ? h('div', { class: 'field' }, inputEl, errEl) : null,
      input?.chips ? h('div', { class: 'chips wrap' }, input.chips.map((c) => chip(c, false, () => { inputEl.value = c; }))) : null,
      h('div', { class: 'modal-actions' }, button(cancel, { variant: 'secondary', onClick: () => done(inputEl ? null : false) }), okBtn));
    scrim.addEventListener('click', () => done(inputEl ? null : false));
    document.body.append(scrim, m);
    requestAnimationFrame(() => { scrim.classList.add('open'); m.classList.add('open'); });
    setTimeout(() => (inputEl || okBtn).focus(), 60);
  });
}

// ---- Numpad --------------------------------------------------------------
export function numpad(onKey) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];
  return h('div', { class: 'numpad' }, keys.map((k) => h('button', { type: 'button', class: k === '⌫' ? 'np-fn' : '', 'aria-label': k === '⌫' ? 'Hapus angka' : k, onClick: () => onKey(k) }, k === '⌫' ? icon('back') : k)));
}

export function kv(label, value) { return h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, value)); }
