// Scanner barcode. Urutan: BarcodeDetector bawaan Chrome Android (butuh Google Play Services)
// → kalau tidak tersedia/ditolak: mode ketik, yang juga dipakai scanner Bluetooth/USB (berperilaku seperti keyboard).
import { h, icon, iconButton, button, pushLayer } from './ui.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

let audioCtx;
export function bip(ok = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.frequency.value = ok ? 1650 : 320; o.type = 'square'; g.gain.value = 0.05;
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + (ok ? 0.09 : 0.22));
  } catch {}
  if (navigator.vibrate) navigator.vibrate(ok ? 50 : [40, 60, 40]);
}

export async function kameraDidukung() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) return false;
  try { const f = await window.BarcodeDetector.getSupportedFormats(); return f.includes('ean_13'); } catch { return false; }
}

/**
 * Buka layar scan penuh.
 * onCode(code) → { ok: true, label } bila barang ketemu (layar tetap terbuka untuk scan berikutnya)
 *              → { ok: false } bila tidak ketemu (layar ditutup, pemanggil menampilkan pilihan)
 */
export async function bukaScanner({ onCode, onManual, judul = 'Scan barcode', lanjut = true }) {
  const bisaKamera = await kameraDidukung();
  let stream = null, detector = null, raf = 0, lastCode = '', lastAt = 0, count = 0, closed = false;

  const lastBox = h('div', { class: 'scan-last', hidden: true, 'aria-live': 'polite' });
  const frame = h('div', { class: 'scan-frame', 'aria-hidden': 'true' });
  const video = h('video', { playsinline: true, muted: true, autoplay: true, 'aria-hidden': 'true' });
  const hint = h('p', { class: 'scan-hint' }, 'Arahkan garis ke barcode');
  const torchBtn = iconButton('flash', 'Senter', toggleTorch, { hidden: true, 'aria-pressed': 'false' });
  const doneBtn = button(lanjut ? 'Selesai scan' : 'Tutup', { variant: 'primary', size: 'lg', block: true, onClick: () => close() });

  // Mode ketik (fallback + scanner Bluetooth)
  const typed = h('input', { class: 'input input-num', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Ketik atau scan angka barcode', 'aria-label': 'Angka barcode' });
  const typedForm = h('form', { class: 'stack', onSubmit: (e) => { e.preventDefault(); const v = typed.value.trim(); if (v) { typed.value = ''; handle(v); } } },
    typed, button('Cari barcode ini', { variant: 'secondary', type: 'submit', block: true }));

  const root = h('div', { class: 'scanner', role: 'dialog', 'aria-modal': 'true', 'aria-label': judul },
    bisaKamera ? video : null, bisaKamera ? frame : null,
    h('div', { class: 'scanner-top' }, iconButton('close', 'Tutup scanner', () => close()), h('strong', null, judul), bisaKamera ? torchBtn : h('span', { style: { width: '48px' } })),
    bisaKamera ? null : h('div', { style: { padding: '24px 16px', position: 'relative', zIndex: 2 }, class: 'stack' },
      h('div', { class: 'alert alert-warning' }, icon('alert', 'icon-sm'), h('div', null, h('strong', null, 'Kamera tidak bisa memindai di browser ini.'), h('p', null, 'Ketik angka di bawah barcode, atau pakai scanner Bluetooth. Untuk scan dengan kamera, buka aplikasi ini lewat Chrome di HP Android.'))),
      typedForm),
    h('div', { class: 'scanner-bottom' },
      bisaKamera ? hint : null, lastBox,
      h('div', { class: 'row' },
        button('Cari nama', { variant: 'secondary', icon: 'search', onClick: () => { close(); onManual && onManual(); }, attrs: { style: 'flex:1' } }),
        bisaKamera ? button('Ketik angka', { variant: 'secondary', icon: 'keyboard', onClick: showTyped, attrs: { style: 'flex:1' } }) : null),
      doneBtn));
  document.body.append(root);
  const release = pushLayer(() => close('back'));

  function showTyped() {
    const sheetLike = h('div', { class: 'scan-last', style: { flexDirection: 'column', alignItems: 'stretch' } }, typedForm);
    lastBox.after(sheetLike); typed.focus();
  }

  async function handle(code) {
    const now = Date.now();
    if (code === lastCode && now - lastAt < 1500) return; // satu barang tidak terbaca dua kali
    lastCode = code; lastAt = now;
    const r = await onCode(code);
    if (r && r.ok) {
      bip(true); count++;
      frame.classList.add('hit'); setTimeout(() => frame.classList.remove('hit'), 300);
      lastBox.hidden = false;
      lastBox.replaceChildren(icon('checkCircle'), h('div', { class: 'grow' }, h('div', { class: 'li-title' }, r.label), h('div', { class: 'li-sub' }, `${count} barang dipindai`)));
      if (!lanjut) close();
    } else {
      bip(false); close('notfound');
    }
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0]; if (!track) return;
    const on = torchBtn.getAttribute('aria-pressed') !== 'true';
    try { await track.applyConstraints({ advanced: [{ torch: on }] }); torchBtn.setAttribute('aria-pressed', String(on)); } catch {}
  }

  function close(mode = 'ui') {
    if (closed) return; closed = true;
    release(mode === 'back' ? 'back' : 'ui');
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    root.remove();
  }

  if (bisaKamera) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream; await video.play();
      const caps = stream.getVideoTracks()[0].getCapabilities?.() || {};
      if (caps.torch) torchBtn.hidden = false;
      const supported = await window.BarcodeDetector.getSupportedFormats();
      detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) });
      let busy = false;
      const loop = async () => {
        if (closed) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          try { const res = await detector.detect(video); if (res.length) await handle(res[0].rawValue); } catch {}
          busy = false;
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      hint.textContent = e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Buka pengaturan Chrome → Izin situs → Kamera, lalu izinkan.' : 'Kamera tidak bisa dibuka. Pakai "Ketik angka".';
      showTyped();
    }
  } else {
    setTimeout(() => typed.focus(), 50);
  }
  return { close };
}
