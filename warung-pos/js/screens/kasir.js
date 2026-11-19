// KASIR — layar terpenting. Spesifikasi: UI_UX_SPECIFICATION.md §B–F.
// Pola: grid produk + bar keranjang melayang → sheet keranjang → sheet bayar → sheet berhasil.
import { h, icon, iconButton, button, header, chip, price, lapakTag, stockTag, sheet, toast, qtyControl, numpad, moneyInput, field, segmented, empty, confirmDialog } from '../ui.js';
import { state, totalKeranjang, jual, batalkan, cariBarcode, bukaSesi, barangMasuk, daftarProduk, emit } from '../store.js';
import { rupiah, ribuan, statusStok, LAPAK, SHIFT, parseQty } from '../format.js';
import { bukaScanner } from '../scanner.js';

const ui = { filter: null, q: '' }; // filter bertahan selama aplikasi terbuka

// ---- Keranjang (state.cart) ------------------------------------------------
function keyItem(i) { return (i.produkId || 'manual:' + i.nama + i.harga) + '|' + i.satuanId; }
export function tambahKeKeranjang(p, u, qty = 1) {
  const item = { produkId: p.id, pemilik: p.pemilik, nama: p.nama, satuan: u.nama, satuanId: u.id, isi: u.isi, harga: u.harga, modal: (p.modalPerDasar || 0) * u.isi, qty };
  const ada = state.cart.find((c) => keyItem(c) === keyItem(item));
  if (ada) ada.qty = Math.round((ada.qty + qty) * 1000) / 1000; else state.cart.push(item);
  emit('cart');
}
function tambahManual({ nama, harga, qty, pemilik }) {
  state.cart.push({ produkId: null, pemilik, nama: nama || 'Barang lain', satuan: 'pcs', satuanId: 'manual', isi: 1, harga, modal: 0, qty, manual: true });
  emit('cart');
}
const jumlahBarang = () => state.cart.reduce((s, i) => s + (i.isi >= 1 && Number.isInteger(i.qty) ? i.qty : 1), 0);

// ---- Layar -------------------------------------------------------------------
export function kasirScreen(ctx) {
  const shift = state.device.shift;
  const bolehJual = shift === 'pagi' ? ['nasi', 'warung'] : ['warung', 'nasi'];
  const semua = [...state.produk.values()].filter((p) => p.aktif && bolehJual.includes(p.pemilik));
  const adaFavorit = semua.some((p) => p.favorit);
  if (!ui.filter) ui.filter = adaFavorit ? 'favorit' : 'semua';

  const grid = h('div', { class: 'product-grid', role: 'list' });
  const chipsEl = h('div', { class: 'chips', role: 'toolbar', 'aria-label': 'Kategori' });
  const searchInput = h('input', { type: 'search', placeholder: 'Cari barang…', 'aria-label': 'Cari barang', value: ui.q, enterkeyhint: 'search', autocomplete: 'off' });
  const cartHost = h('div');

  const kategori = [...new Set(semua.map((p) => p.kategori).filter(Boolean))];
  function renderChips() {
    const opts = [adaFavorit && ['favorit', 'Favorit'], ['semua', 'Semua'], ...(shift === 'pagi' ? [['lapak:nasi', 'Nasi'], ['lapak:warung', 'Warung']] : []), ...kategori.map((k) => ['kat:' + k, k])].filter(Boolean);
    chipsEl.replaceChildren(...opts.map(([v, l]) => chip(l, ui.filter === v && !ui.q, () => { ui.filter = v; ui.q = ''; searchInput.value = ''; renderGrid(); renderChips(); })));
  }

  function daftar() {
    const q = ui.q.trim().toLowerCase();
    let arr = semua;
    if (q) arr = arr.filter((p) => p.nama.toLowerCase().includes(q) || (p.satuan || []).some((u) => u.barcode && u.barcode.includes(q)));
    else if (ui.filter === 'favorit') arr = arr.filter((p) => p.favorit);
    else if (ui.filter.startsWith('lapak:')) arr = arr.filter((p) => p.pemilik === ui.filter.slice(6));
    else if (ui.filter.startsWith('kat:')) arr = arr.filter((p) => p.kategori === ui.filter.slice(4));
    // Lapak milik shift ini dulu, lalu nama
    const urut = { [bolehJual[0]]: 0, [bolehJual[1]]: 1 };
    return arr.sort((a, b) => (urut[a.pemilik] - urut[b.pemilik]) || a.nama.localeCompare(b.nama, 'id'));
  }

  function qtyDiKeranjang(p) { return state.cart.filter((c) => c.produkId === p.id).reduce((s, c) => s + c.qty, 0); }

  function tile(p) {
    const qty = qtyDiKeranjang(p);
    const u0 = p.satuan[0];
    const st = statusStok(p);
    const multi = p.satuan.length > 1;
    return h('button', { type: 'button', role: 'listitem', class: ['tile', qty && 'in-cart'], 'aria-label': `${p.nama}, ${rupiah(u0.harga)}${multi ? ', ada beberapa satuan' : ''}${qty ? `, ${qty} di keranjang` : ''}`,
      onClick: () => pilih(p) },
      h('span', { class: ['tile-lapak', p.pemilik], title: LAPAK[p.pemilik] }),
      h('span', { class: 'tile-name' }, p.nama),
      h('span', { class: 'tile-foot' },
        h('span', { class: 'stack', style: { gap: '2px' } },
          price(u0.harga, 'md'),
          multi ? h('span', { class: 'tile-units' }, p.satuan.map((u) => u.nama).join(' / ')) : (st === 'low' || st === 'out' ? stockTag(p) : h('span', { class: 'tile-units' }, '/' + u0.nama)))),
      qty ? h('span', { class: 'tile-qty' }, String(qty).replace('.', ',')) : null);
  }

  function renderGrid() {
    const arr = daftar();
    if (!semua.length) {
      grid.replaceWith(grid); grid.replaceChildren(h('div', { style: { gridColumn: '1/-1' } }, empty({ ic: 'box', title: 'Belum ada barang', text: 'Tambahkan barang yang dijual supaya bisa dipilih di sini.', action: button('Tambah barang', { icon: 'plus', onClick: () => ctx.go('/produk/baru') }) })));
      return;
    }
    if (!arr.length) {
      grid.replaceChildren(h('div', { style: { gridColumn: '1/-1' } }, empty({ ic: 'search', title: ui.q ? `"${ui.q}" tidak ada` : 'Kosong', text: ui.q ? 'Cek ejaan, atau jual sebagai barang lain dengan harga yang diketik.' : 'Belum ada barang di kategori ini.',
        action: ui.q ? button('Jual sebagai barang lain', { variant: 'secondary', onClick: () => manualSheet(ui.q) }) : null })));
      return;
    }
    grid.replaceChildren(...arr.map(tile), h('button', { type: 'button', class: 'tile tile-manual', onClick: () => manualSheet() }, icon('plus'), 'Barang lain', h('span', { class: 'tile-units' }, 'ketik harga')));
  }

  function pilih(p) {
    if (statusStok(p) === 'out' && !qtyDiKeranjang(p)) toast(`Stok ${p.nama} tercatat habis. Tetap dijual — cek stoknya nanti.`, { kind: 'warning', duration: 2200 });
    if (p.satuan.length === 1) { tambahKeKeranjang(p, p.satuan[0]); refresh(); return; }
    const s = sheet({ title: p.nama, body: h('div', { class: 'stack' },
      h('p', { class: 'secondary' }, 'Pilih satuan'),
      ...p.satuan.map((u) => h('button', { type: 'button', class: 'list-item card', style: { borderRadius: 'var(--radius-md)', border: '1.5px solid var(--color-border-strong)' }, onClick: () => { tambahKeKeranjang(p, u); s.close(); refresh(); } },
        h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, 'Per ' + u.nama), u.isi > 1 ? h('span', { class: 'li-sub' }, `isi ${String(u.isi).replace('.', ',')} ${p.satuanDasar}`) : null),
        price(u.harga, 'md'))),
      h('div', { class: 'li-sub', style: { marginTop: '4px' } }, stockTag(p))) });
  }

  // ---- Bar keranjang ------------------------------------------------------
  function renderCartBar() {
    if (!state.cart.length) { cartHost.replaceChildren(); document.getElementById('main')?.classList.remove('has-cartbar'); return; }
    document.getElementById('main')?.classList.add('has-cartbar');
    const total = totalKeranjang();
    cartHost.replaceChildren(h('button', { type: 'button', class: 'cart-bar', onClick: keranjangSheet, 'aria-label': `Keranjang, ${state.cart.length} barang, total ${rupiah(total)}. Buka keranjang` },
      h('div', { class: 'stack', style: { gap: '0' } }, h('span', { class: 'cb-count' }, `${state.cart.length} macam barang`), price(total, 'md')),
      h('span', { class: 'cb-pay' }, 'Bayar', icon('chev', 'icon-sm'))));
  }
  function refresh() { renderGrid(); renderCartBar(); }

  // ---- Sheet keranjang --------------------------------------------------------
  function keranjangSheet() {
    let s;
    const body = () => {
      const perLapak = { nasi: 0, warung: 0 };
      state.cart.forEach((i) => (perLapak[i.pemilik] += Math.round(i.harga * i.qty)));
      return h('div', null,
        state.cart.map((it) => h('div', { class: 'cart-item' },
          h('div', null, h('div', { class: 'ci-name' }, it.nama), h('div', { class: 'ci-meta' }, lapakTag(it.pemilik), `${rupiah(it.harga)} / ${it.satuan}`)),
          price(Math.round(it.harga * it.qty), 'sm'),
          h('div', { class: 'ci-controls' },
            qtyControl(it.qty, (v) => { if (v <= 0) state.cart.splice(state.cart.indexOf(it), 1); else it.qty = v; emit('cart'); update(); }, { step: 1, min: 1, label: 'Jumlah ' + it.nama }),
            h('button', { type: 'button', class: 'btn btn-ghost', style: { color: 'var(--color-danger)' }, onClick: () => { state.cart.splice(state.cart.indexOf(it), 1); emit('cart'); update(); } }, icon('trash', 'icon-sm'), 'Hapus')))),
        perLapak.nasi && perLapak.warung ? h('div', { class: 'stack', style: { gap: '0', marginTop: '8px' } },
          h('div', { class: 'kv' }, lapakTag('nasi'), price(perLapak.nasi, 'sm')),
          h('div', { class: 'kv' }, lapakTag('warung'), price(perLapak.warung, 'sm'))) : null);
    };
    const foot = () => h('div', { class: 'stack' },
      h('div', { class: 'row-between' }, h('span', { class: 'stat-label' }, 'Total'), price(totalKeranjang(), 'lg')),
      button(`Bayar ${rupiah(totalKeranjang())}`, { size: 'lg', block: true, onClick: () => { s.close(); bayarSheet(); } }),
      button('Kosongkan keranjang', { variant: 'ghost', block: true, onClick: async () => { if (await confirmDialog({ title: 'Kosongkan keranjang?', text: 'Semua barang di keranjang dihapus.', ok: 'Kosongkan', danger: true })) { state.cart = []; emit('cart'); s.close(); refresh(); } } }));
    const update = () => { if (!state.cart.length) { s.close(); refresh(); return; } s.setBody(body()); s.setFoot(foot()); refresh(); };
    s = sheet({ title: 'Keranjang', body: body(), foot: foot(), onClose: refresh });
  }

  // ---- Sheet bayar -----------------------------------------------------------------
  function bayarSheet() {
    const total = totalKeranjang();
    let dibayar = 0;
    // Pecahan yang masuk akal diterima: kelipatan 5rb/10rb berikutnya, lalu lembaran 20/50/100rb
    const saran = [...new Set([Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, 20000, 50000, 100000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])]
      .filter((v) => v > total).sort((a, b) => a - b).slice(0, 4);
    const paidEl = h('div', { class: 'price price-display', 'aria-live': 'polite' });
    const changeEl = h('div');
    const doneBtn = button('Simpan transaksi', { size: 'lg', block: true, onClick: simpan });
    function show() {
      paidEl.replaceChildren(h('span', { class: 'rp' }, 'Rp'), dibayar ? dibayar.toLocaleString('id-ID') : '0');
      paidEl.style.color = dibayar ? '' : 'var(--color-text-muted)';
      if (!dibayar) changeEl.replaceChildren(h('span', { class: 'muted' }, 'Pilih nominal atau ketik uang yang diterima'));
      else if (dibayar < total) changeEl.replaceChildren(h('span', { style: { color: 'var(--color-danger)', font: 'var(--text-body-strong)' } }, 'Kurang ', price(total - dibayar, 'sm')));
      else changeEl.replaceChildren(h('div', { class: 'row-between' }, h('span', { class: 'stat-label' }, 'Kembalian'), h('span', { style: { color: 'var(--color-success)' } }, price(dibayar - total, 'lg'))));
      doneBtn.disabled = dibayar < total;
      quick.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.v) === dibayar)));
    }
    const quick = h('div', { class: 'chips wrap', style: { gap: '8px' } },
      [total, ...saran].map((v, i) => { const c = chip(i === 0 ? 'Uang pas' : ribuan(v), false, () => { dibayar = v; show(); }); c.dataset.v = v; c.style.minHeight = '48px'; c.style.flex = '1 0 calc(50% - 8px)'; c.style.justifyContent = 'center'; return c; }));
    const pad = numpad((k) => {
      let s = String(dibayar || '');
      if (k === '⌫') s = s.slice(0, -1); else s = (s + k).slice(0, 9);
      dibayar = parseInt(s || '0', 10); show();
    });
    async function simpan() {
      if (dibayar < total) return;
      doneBtn.classList.add('is-loading');
      try {
        const rec = await jual({ items: state.cart, dibayar });
        state.cart = []; emit('cart');
        s.close(); refresh();
        suksesSheet(rec);
      } catch (e) { toast(e.message, { kind: 'error' }); doneBtn.classList.remove('is-loading'); }
    }
    const s = sheet({ title: 'Pembayaran', full: true, body: h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'stat-hero' }, h('span', { class: 'stat-label' }, 'Total belanja'), price(total, 'display')),
      h('hr', { class: 'rule' }),
      h('div', { class: 'stat-hero' }, h('span', { class: 'stat-label' }, 'Uang diterima'), paidEl),
      changeEl, quick, pad),
      foot: doneBtn });
    show();
  }

  // ---- Sheet berhasil -----------------------------------------------------------------
  function suksesSheet(rec) {
    const s = sheet({ title: 'Transaksi tersimpan', label: 'Transaksi berhasil', body: h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'row', style: { color: 'var(--color-success)' } }, icon('checkCircle'), h('strong', null, `No. ${rec.no}`), h('span', { class: 'muted' }, '· tersimpan di HP')),
      h('div', { class: 'stat-hero' }, h('span', { class: 'stat-label' }, 'Kembalian'), price(rec.kembalian, 'display')),
      h('dl', { class: 'stack', style: { gap: 0 } },
        h('div', { class: 'kv' }, h('dt', null, 'Total'), h('dd', null, price(rec.total, 'sm'))),
        h('div', { class: 'kv' }, h('dt', null, 'Dibayar'), h('dd', null, price(rec.dibayar, 'sm')))),
      h('details', null, h('summary', { style: { minHeight: '44px', display: 'flex', alignItems: 'center', cursor: 'pointer', font: 'var(--text-label)', color: 'var(--color-primary)' } }, `Lihat ${rec.items.length} barang`),
        rec.items.map((it) => h('div', { class: 'kv' }, h('dt', null, `${String(it.qty).replace('.', ',')} × ${it.nama}`), h('dd', null, price(it.subtotal, 'sm')))))),
      foot: h('div', { class: 'stack' },
        button('Transaksi baru', { size: 'lg', block: true, attrs: { autofocus: true }, onClick: () => s.close() }),
        button('Batalkan transaksi ini', { variant: 'ghost', block: true, attrs: { style: 'color: var(--color-danger)' }, onClick: async () => {
          const alasan = await confirmDialog({ title: 'Batalkan transaksi?', text: 'Stok dikembalikan. Transaksi tetap tercatat dengan status batal.', ok: 'Batalkan', danger: true, input: { placeholder: 'Alasan, mis. salah tekan', required: true, chips: ['Salah tekan', 'Pembeli batal'] } });
          if (alasan) { await batalkan(rec.id, alasan); s.close(); refresh(); toast('Transaksi dibatalkan'); }
        } })) });
  }

  // ---- Sheet barang lain (manual) -----------------------------------------------------
  function manualSheet(namaAwal = '') {
    let harga = 0, qty = 1, pemilik = shift === 'siang' ? 'warung' : 'warung';
    let err = '';
    const nama = h('input', { class: 'input', value: namaAwal, placeholder: 'Barang lain', autocomplete: 'off' });
    const errBox = h('div');
    const body = h('div', { class: 'stack', style: { gap: '16px' } },
      field('Nama barang', nama, { optional: true }),
      h('div', null, field('Harga satuan', moneyInput(0, (v) => (harga = v), { autofocus: true })), errBox),
      field('Jumlah', qtyControl(1, (v) => (qty = v), { min: 1 })),
      shift === 'pagi' ? field('Uangnya milik', segmented('pemilik-manual', [['warung', 'Warung (Ibu)'], ['nasi', 'Nasi']], pemilik, (v) => (pemilik = v))) : null,
      h('p', { class: 'field-help' }, 'Barang ini tidak mengurangi stok. Kalau sering dijual, daftarkan sebagai barang.'));
    const s = sheet({ title: 'Barang lain', body, foot: button('Tambah ke keranjang', { size: 'lg', block: true, onClick: () => {
      if (!harga) { errBox.replaceChildren(h('div', { class: 'field-error', role: 'alert' }, 'Harga wajib diisi')); return; }
      tambahManual({ nama: nama.value.trim(), harga, qty, pemilik }); s.close(); refresh();
    } }) });
  }

  // ---- Scan ---------------------------------------------------------------------------
  async function scan() {
    let tidakKetemu = null;
    await bukaScanner({
      onCode: (code) => {
        const r = cariBarcode(code);
        if (r) { tambahKeKeranjang(r.produk, r.satuan); refresh(); return { ok: true, label: `${r.produk.nama} (${r.satuan.nama}) +1` }; }
        tidakKetemu = code; setTimeout(() => barcodeBaru(code), 50); return { ok: false };
      },
      onManual: () => searchInput.focus(),
    });
  }
  function barcodeBaru(code) {
    const s = sheet({ title: 'Barcode belum terdaftar', body: h('div', { class: 'stack' },
      h('p', null, 'Barcode ', h('strong', { class: 'num' }, code), ' belum ada di daftar barang.'),
      button('Daftarkan barang ini', { size: 'lg', block: true, icon: 'plus', onClick: () => { sessionStorage.setItem('prefill', JSON.stringify({ barcode: code, dariKasir: true })); s.close(); ctx.go('/produk/baru'); } }),
      button('Cari dengan nama', { variant: 'secondary', block: true, icon: 'search', onClick: () => { s.close(); searchInput.focus(); } }),
      button('Jual sebagai barang lain', { variant: 'secondary', block: true, onClick: () => { s.close(); manualSheet(); } }),
      button('Scan lagi', { variant: 'ghost', block: true, onClick: () => { s.close(); scan(); } })) });
  }

  searchInput.addEventListener('input', () => { ui.q = searchInput.value; renderGrid(); renderChips(); });
  searchInput.addEventListener('keydown', (e) => { // scanner Bluetooth mengetik angka lalu Enter
    if (e.key === 'Enter') { const v = searchInput.value.trim(); if (/^\d{6,}$/.test(v)) { const r = cariBarcode(v); searchInput.value = ''; ui.q = ''; if (r) { tambahKeKeranjang(r.produk, r.satuan); toast(`${r.produk.nama} +1`); } else barcodeBaru(v); refresh(); renderChips(); } else searchInput.blur(); }
  });

  renderChips(); renderGrid(); renderCartBar();
  const node = h('div', null,
    header({ title: 'Kasir', sub: `Shift ${SHIFT[shift].toLowerCase()} · ${state.device.nama}`, shift, actions: [ctx.syncBadge()] }),
    h('div', { class: 'page', style: { gap: '12px', paddingTop: '12px' } },
      h('div', { class: 'row', style: { gap: '8px' } },
        h('label', { class: 'search grow' }, icon('search'), searchInput,
          ui.q ? iconButton('close', 'Hapus pencarian', () => { searchInput.value = ''; ui.q = ''; renderGrid(); renderChips(); searchInput.focus(); }) : null),
        h('button', { type: 'button', class: 'btn btn-primary', style: { width: '56px', padding: 0 }, 'aria-label': 'Scan barcode', onClick: scan }, icon('scan'))),
      chipsEl, grid),
    cartHost);

  return {
    node, cartbar: state.cart.length > 0,
    after() {
      // Tambahkan barang yang baru didaftarkan dari scan
      const tambah = sessionStorage.getItem('tambahKeKeranjang');
      if (tambah) { sessionStorage.removeItem('tambahKeKeranjang'); const p = state.produk.get(tambah); if (p) { tambahKeKeranjang(p, p.satuan[0]); refresh(); toast(`${p.nama} masuk keranjang`); } }
      if (!state.sesi) mulaiShiftSheet(() => {});
    },
  };
}

// ---- Mulai shift ---------------------------------------------------------------------
export function mulaiShiftSheet(done) {
  let kas = null;
  const shift = state.device.shift;
  // Shift pagi: sekalian isi jumlah nasi/jajanan yang dibuat hari ini (mode stok harian)
  const harian = shift === 'pagi' ? daftarProduk().filter((p) => p.modeStok === 'harian') : [];
  const jumlah = Object.fromEntries(harian.map((p) => [p.id, Math.max(0, p.stok || 0)]));
  async function mulai(kasAwal) {
    const items = harian.filter((p) => jumlah[p.id] > (p.stok || 0)).map((p) => ({ produkId: p.id, satuan: p.satuanDasar, isi: 1, qty: jumlah[p.id] - Math.max(0, p.stok || 0), hargaBeli: 0 }));
    if (items.length) await barangMasuk({ pemasok: '', dariLaci: false, items, catatan: 'Stok pagi' });
    await bukaSesi(kasAwal); s.close(); done();
  }
  const s = sheet({ title: `Mulai shift ${SHIFT[shift].toLowerCase()}`, body: h('div', { class: 'stack', style: { gap: '16px' } },
    h('p', null, `${state.device.nama}, berapa uang di laci sekarang? Angka ini dipakai untuk mencocokkan uang saat tutup shift.`),
    field('Uang di laci', moneyInput(0, (v) => (kas = v), { autofocus: true }), { help: 'Termasuk uang kembalian yang disiapkan.' }),
    harian.length ? h('section', { class: 'section' }, h('h3', { class: 'section-title' }, 'Yang dibuat hari ini'),
      h('div', { class: 'list' }, harian.map((p) => h('div', { class: 'list-item' }, h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, p.nama), h('span', { class: 'li-sub' }, p.satuanDasar)),
        qtyControl(jumlah[p.id], (v) => (jumlah[p.id] = v), { min: 0, step: 1, label: 'Jumlah ' + p.nama })))),
      h('p', { class: 'field-help' }, 'Boleh dilewati. Kalau diisi, kasir bisa memberi tahu saat hampir habis.')) : null),
    foot: h('div', { class: 'stack' },
      button('Mulai jualan', { size: 'lg', block: true, onClick: () => mulai(kas || 0) }),
      button('Lewati, isi nanti', { variant: 'ghost', block: true, onClick: () => mulai(null) })),
    onClose: async (reason) => { if (reason === 'scrim' || reason === 'esc') { if (!state.sesi) await bukaSesi(null); } } });
}
