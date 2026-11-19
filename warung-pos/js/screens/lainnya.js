// LAINNYA, PENGATURAN, SALINAN KE GOOGLE
import { h, icon, button, header, field, segmented, chip, toast, confirmDialog, alertBox, iconButton } from '../ui.js';
import { state, simpanDevice, simpanSettings, DEFAULT_KATEGORI } from '../store.js';
import * as sync from '../sync.js';
import * as db from '../db.js';
import { jam, tanggalPendek, tanggalKey, SHIFT, LAPAK } from '../format.js';

const menuItem = (href, ic, title, sub) => h('a', { class: 'list-item menu-item', href },
  icon(ic), h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, title), sub ? h('span', { class: 'li-sub' }, sub) : null), icon('chev', 'chev'));

export function lainnyaScreen(ctx) {
  const sesi = state.sesi;
  const syncSub = h('span');
  ctx.onCleanup(sync.onStatus((s) => syncSub.replaceChildren(s.mode === 'off' ? 'Belum tersambung' : s.pending ? `${s.pending} catatan menunggu` : s.terakhir ? `Terakhir ${jam(s.terakhir)}` : 'Tersambung')));
  return h('div', null,
    header({ title: 'Lainnya', sub: `${state.settings.namaWarung} · HP ${state.device.nama}`, shift: state.device.shift, actions: [ctx.syncBadge()] }),
    h('div', { class: 'page' },
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Shift'),
        h('div', { class: 'list' }, menuItem('#/tutup', 'lock', 'Tutup shift', sesi ? `Shift ${SHIFT[sesi.shift].toLowerCase()} berjalan sejak ${jam(sesi.dibuka)}` : 'Belum ada shift berjalan'))),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Catatan'),
        h('div', { class: 'list' },
          menuItem('#/pengeluaran', 'wallet', 'Pengeluaran', 'Gas, listrik, bahan baku'),
          menuItem('#/riwayat', 'receipt', 'Riwayat transaksi', 'Cari, lihat detail, batalkan'),
          menuItem('#/laporan', 'chart', 'Laporan', 'Penjualan, laba, paling laku'))),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Sistem'),
        h('div', { class: 'list' },
          h('a', { class: 'list-item menu-item', href: '#/salinan' }, icon('cloud'), h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, 'Salinan ke Google'), h('span', { class: 'li-sub' }, syncSub)), icon('chev', 'chev')),
          menuItem('#/pengaturan', 'gear', 'Pengaturan', 'Nama warung, HP ini, kategori, data'))),
      h('p', { class: 'muted', style: { textAlign: 'center', font: 'var(--text-caption)' } }, 'Warung POS v1.0 · data tersimpan di HP ini')));
}

export function pengaturanScreen(ctx) {
  const s = { ...state.settings, kategori: JSON.parse(JSON.stringify(state.settings.kategori || DEFAULT_KATEGORI)) };
  const d = { ...state.device };
  const body = h('div', { class: 'stack', style: { gap: '24px' } });

  function render() {
    body.replaceChildren(
      field('Nama warung', h('input', { class: 'input', value: s.namaWarung, onInput: (e) => (s.namaWarung = e.target.value) })),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'HP ini'),
        field('Nama penjaga', h('input', { class: 'input', value: d.nama, onInput: (e) => (d.nama = e.target.value) })),
        field('Dipakai untuk', segmented('shift-hp', [['pagi', 'Shift pagi'], ['siang', 'Shift siang']], d.shift, async (v) => {
          if (state.sesi) { toast('Tutup shift yang sedang berjalan dulu', { kind: 'error' }); render(); return; }
          d.shift = v;
        }), { help: 'Ganti hanya kalau HP ini dipakai bergantian. Transaksi lama tidak berubah.' })),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Kategori barang'),
        ...['nasi', 'warung'].map((lap) => h('div', { class: 'field' }, h('span', { class: 'field-label' }, LAPAK[lap]),
          h('div', { class: 'chips wrap' }, s.kategori[lap].map((k, i) => h('span', { class: 'chip', style: { paddingRight: '4px' } }, k, iconButton('close', 'Hapus kategori ' + k, () => { s.kategori[lap].splice(i, 1); render(); }, { style: 'width:32px;height:32px' }))),
            h('button', { type: 'button', class: 'chip', onClick: async () => { const v = await confirmDialog({ title: `Kategori baru (${LAPAK[lap]})`, ok: 'Tambah', input: { placeholder: 'mis. Gorengan', required: true } }); if (v) { s.kategori[lap].push(v); render(); } } }, icon('plus', 'icon-sm'), 'Tambah'))))),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Data di HP ini'),
        button('Unduh cadangan (.json)', { variant: 'secondary', icon: 'download', block: true, onClick: cadangan }),
        h('p', { class: 'field-help' }, 'Cadangan tambahan selain salinan Google. Simpan di Google Drive atau kirim ke WhatsApp sendiri.'),
        button('Hapus semua data di HP ini', { variant: 'danger', block: true, icon: 'trash', onClick: hapusSemua })));
  }
  async function cadangan() {
    const out = {};
    for (const st of db.STORES) out[st] = await db.getAll(st);
    const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' })), download: `cadangan-warung-${tanggalKey(new Date().toISOString())}.json` });
    document.body.append(a); a.click(); a.remove();
  }
  async function hapusSemua() {
    const c1 = await confirmDialog({ title: 'Hapus semua data di HP ini?', text: 'Barang, transaksi, dan pengaturan di HP ini hilang. Data yang sudah tersalin ke Google tetap ada dan bisa dipulihkan.', ok: 'Lanjut', danger: true });
    if (!c1) return;
    const c2 = await confirmDialog({ title: 'Ketik HAPUS untuk yakin', ok: 'Hapus permanen', danger: true, input: { placeholder: 'HAPUS', required: true } });
    if (c2 !== 'HAPUS') { if (c2) toast('Teks tidak cocok, data tidak dihapus', { kind: 'error' }); return; }
    await db.clearAll(); location.hash = '/setup'; location.reload();
  }
  render();
  return h('div', null, header({ title: 'Pengaturan', back: '#/lainnya' }),
    h('div', { class: 'page' }, body,
      h('div', { class: 'sticky-foot' }, button('Simpan pengaturan', { size: 'lg', block: true, onClick: async () => {
        if (!d.nama.trim()) { toast('Nama penjaga wajib diisi', { kind: 'error' }); return; }
        await simpanSettings({ ...s, namaWarung: s.namaWarung.trim() || 'Warung' }); await simpanDevice({ ...d, nama: d.nama.trim() });
        toast('Pengaturan disimpan'); ctx.go('/lainnya');
      } }))));
}

export async function salinanScreen(ctx) {
  const cfg = (await sync.konfigurasi()) || { url: '', kode: '' };
  const statusEl = h('div');
  const url = h('input', { class: 'input', value: cfg.url, placeholder: 'https://script.google.com/macros/s/…/exec', inputmode: 'url', autocomplete: 'off' });
  const kode = h('input', { class: 'input tnum', value: cfg.kode, placeholder: 'mis. 7F3A9C21', autocomplete: 'off', style: { textTransform: 'uppercase' } });
  ctx.onCleanup(sync.onStatus((s) => {
    const map = { off: ['info', 'cloudOff', 'Belum tersambung ke Google. Data hanya ada di HP ini.'], ok: ['success', 'checkCircle', `Semua data sudah tersalin${s.terakhir ? ' · ' + tanggalPendek(tanggalKey(s.terakhir)) + ' ' + jam(s.terakhir) : ''}.`],
      pending: ['warning', 'clock', `${s.pending} catatan menunggu dikirim.`], offline: ['warning', 'cloudOff', `Tanpa sinyal. ${s.pending} catatan akan dikirim otomatis saat ada sinyal.`], error: ['danger', 'alert', `Gagal menyalin: ${s.pesan}. Data tetap aman di HP.`] };
    const [k, ic, t] = map[s.mode] || map.off;
    statusEl.replaceChildren(alertBox(k, ic, t));
  }));
  return h('div', null, header({ title: 'Salinan ke Google', back: '#/lainnya' }),
    h('div', { class: 'page' }, statusEl,
      button('Kirim & ambil sekarang', { variant: 'secondary', icon: 'refresh', block: true, onClick: () => sync.jalankan() }),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Sambungan'),
        field('Alamat Apps Script', url, { help: 'Dari Google Sheets keluarga → Ekstensi → Apps Script → Deploy.' }),
        field('Kode rahasia', kode, { help: 'Ada di tab "Pengaturan" pada Google Sheets.' }),
        h('div', { class: 'row', style: { gap: '8px' } },
          button('Tes', { variant: 'secondary', onClick: async (e) => { const b = e.currentTarget; b.classList.add('is-loading'); try { const r = await sync.tesKoneksi({ url: url.value.trim(), kode: kode.value.trim().toUpperCase() }); toast(`Tersambung ke "${r.nama}"`); } catch (err) { toast('Tidak tersambung: ' + err.message, { kind: 'error' }); } b.classList.remove('is-loading'); } }),
          button('Simpan sambungan', { attrs: { style: 'flex:1' }, onClick: async () => { await sync.simpanKonfigurasi({ url: url.value.trim(), kode: kode.value.trim().toUpperCase() }); toast('Sambungan disimpan'); } }))),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'HP baru atau rusak?'),
        h('p', { class: 'secondary' }, 'Pulihkan mengambil semua catatan dari Google Sheets ke HP ini. Catatan yang sudah ada tidak digandakan.'),
        button('Pulihkan dari Google', { variant: 'secondary', icon: 'download', block: true, onClick: async (e) => {
          const b = e.currentTarget;
          if (!(await confirmDialog({ title: 'Pulihkan data?', text: 'Bisa memakan waktu 1–2 menit. Jangan tutup aplikasi.', ok: 'Pulihkan' }))) return;
          b.classList.add('is-loading');
          try { const n = await sync.pulihkan({ url: url.value.trim(), kode: kode.value.trim().toUpperCase() }); toast(`${n} catatan dipulihkan`); } catch (err) { toast('Gagal: ' + err.message, { kind: 'error' }); }
          b.classList.remove('is-loading');
        } }))));
}
