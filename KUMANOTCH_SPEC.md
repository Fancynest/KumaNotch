# KumaNotch — Spec & Panduan Agent

> Dokumen ini adalah sumber kebenaran untuk arah proyek. Baca SELURUHNYA sebelum mengubah kode. Kerjakan per fase (bagian 6), jangan loncat.

## 0. Cara pakai dokumen ini (untuk agent)

- Baca kode yang ada sebelum mengubah apa pun. Jangan menebak isi file.
- Kerjakan satu fase sekali. Selesai satu fase = acceptance criteria terpenuhi + build lolos + commit kecil-kecil dengan pesan jelas.
- API Tauri, plugin, dan crate `windows` berubah antar versi. **Verifikasi ke dokumentasi resmi versi yang terpasang**, jangan mengandalkan ingatan. Kalau API yang disebut di dokumen ini ternyata beda, ikuti dokumentasi dan catat di `docs/DECISIONS.md`.
- Jangan menambah dependency tanpa alasan tertulis. Prioritas: ringan, maintained, lisensi kompatibel MIT.
- Jangan mengganti stack lagi tanpa persetujuan pemilik proyek.
- Kalau ada hal ambigu yang mengubah arah (bukan detail kecil), berhenti dan tanya pemilik.
- Jangan menyalin teks, aset, atau data sampel dari produk lain (khususnya Nusa). Pakai data sampel sendiri.

## 1. Visi & prinsip

KumaNotch adalah "Dynamic Island" untuk Windows 10/11: kapsul hitam kecil melayang di tengah atas layar yang menampilkan aktivitas (timer, musik, dll), lalu menyingkir saat tidak dibutuhkan. Dibuat untuk mempermudah pemilik, dan syukur berguna untuk orang banyak (open source, MIT).

Prinsip:
1. **Ringan**: idle harus mendekati 0% CPU. Klaim "ringan" di README hanya boleh ditulis setelah diukur.
2. **Diam kalau tidak ada apa-apa**: state awal hanya jam.
3. **Lokal & privat**: tanpa akun, tanpa telemetri.
4. **Tidak mengganggu**: tidak menutupi aplikasi fullscreen, tidak memblokir klik area sekitar.
5. **Punya identitas sendiri**: karakter beruang "Kuma" sebagai pembeda.

Non-goals (untuk sekarang): macOS/Linux, sinkronisasi cloud, membaca timer aplikasi Clock bawaan Windows (tidak ada API publiknya; KumaNotch punya timer sendiri).

## 2. Keputusan stack (FINAL)

| Lapisan | Pilihan |
|---|---|
| Shell/runtime | **Tauri 2** (Rust + WebView2), menggantikan Electron |
| Frontend | React + TypeScript + Vite + Tailwind v4 + Framer Motion (dipertahankan dari prototipe) |
| State frontend | Zustand (kecil, tanpa boilerplate) |
| Integrasi OS | Rust, crate `windows` (SMTC, Core Audio, registry, shell state) |
| Penyimpanan | File JSON di app data dir (`tauri-plugin-store` atau setara) |
| Installer | Tauri bundler (NSIS/MSI) + GitHub Actions (`tauri-action`) |

Alasan: UI prototipe (React + Framer Motion) tetap terpakai, ukuran installer dan RAM turun dibanding Electron, dan Rust bisa memanggil WinRT/Win32 langsung (musik via SMTC tanpa helper exe terpisah).

Catatan jujur: WebView2 tetap berbasis Chromium, jadi penghematan RAM itu nyata tapi moderat (kisaran 2x lebih kecil, bukan 10x). Target di bagian 7 harus **diukur**, bukan diasumsikan.

Alternatif yang dipertimbangkan dan ditolak: tetap Electron (RAM besar, butuh helper native untuk SMTC), WPF/WinUI 3 (paling ringan tapi UI harus ditulis ulang dan spring animation harus dibuat manual).

## 3. Arsitektur

```
src-tauri/  (Rust)
  window.rs      posisi, ukuran, multi-monitor, deteksi fullscreen, ignore-cursor
  tray.rs        tray icon + menu (Settings, Start with Windows, Personality, Quit)
  media.rs       SMTC: sesi media, kontrol, seek, thumbnail → event ke frontend
  timer.rs       (opsional) persistensi timer; logika utama boleh di frontend
  shelf.rs       drag-out native, validasi path, buka/reveal di Explorer
  system.rs      indikator mic/kamera, volume, caps lock, baterai (fase lanjut)
  lib.rs         wiring, single instance, plugin

src/  (React)
  core/activities.ts     registry aktivitas + aturan prioritas (bagian 5)
  core/store.ts          Zustand store
  core/windowSizing.ts   tabel ukuran window per state + koreografi resize
  features/clock/  features/timer/  features/media/  features/shelf/
  ui/Capsule.tsx  ui/Bubble.tsx  ui/ExpandedCard.tsx  ui/Pager.tsx
  i18n/          string UI (EN + ID)
```

Komunikasi Rust → React lewat event Tauri (mis. `media://changed`); React → Rust lewat `invoke`. Rust yang memegang hal OS-level; React hanya render dan logika UI.

## 4. Window & posisi (spec)

- Window tanpa frame, transparan, selalu di atas, tidak muncul di taskbar, tanpa shadow bawaan OS (shadow digambar CSS).
- **Window ukurannya mengikuti state** (bukan window besar tetap). Ukuran = konstanta per state + padding untuk bayangan. **Padding tiap sisi harus ≥ blur + offset + spread bayangan CSS** (praktisnya ≥ 40px, lebih besar di sisi bawah). Kalau bayangan lebih besar dari padding, ia terpotong di tepi window dan tampak sebagai "bayangan kotak" (bug yang sudah terjadi di build awal). Pastikan juga background webview benar-benar transparan (`html`, `body`, `#root`) dan bayangan bawaan OS dimatikan (`shadow: false`). Jangan pakai `backdrop-filter`. Ini menggantikan pendekatan click-through lama (window 760×280 yang menangkap klik di area transparan).
- Ukuran window berasal dari **tabel konstanta per state**, BUKAN dari ResizeObserver (supaya window tidak mengejar animasi tiap frame).
- Koreografi resize:
  - Expand: besarkan window dulu → animasikan konten (spring).
  - Collapse: animasikan konten dulu → kecilkan window setelah animasi selesai.
- Posisi: tengah atas monitor aktif (default monitor utama), offset atas ±8px. Hitung dalam ukuran fisik dengan scale factor; hitung ulang saat resolusi/DPI/monitor berubah.
- Perilaku saat ada aplikasi lain di depan: lihat bagian 5.1 (Droplet untuk app mode biasa; sembunyikan total hanya untuk fullscreen eksklusif/game/presentasi). Gunakan `SHQueryUserNotificationState` (atau pendekatan setara yang terverifikasi).
- Single instance: instance kedua hanya memfokuskan yang sudah ada.
- Tray icon wajib: Settings, "Start with Windows" (toggle), "Personality" (toggle mata Kuma), Quit. Tanpa tray, aplikasi tidak bisa ditutup normal.
- Expand dengan **klik**. Collapse: klik di luar (window blur), tombol Esc, atau inaktif ±10 detik pada halaman Home. Hover-to-open boleh jadi opsi di Settings, bukan default.

## 5. Model aktivitas & state machine UI

State dasar: **Idle** = kapsul kecil berisi jam. Klik → **Home (expanded)**.

```ts
type ActivityKind = 'alert' | 'hud' | 'timer' | 'indicator' | 'media' | 'calendar'
interface Activity {
  id: string
  kind: ActivityKind
  priority: number        // alert 100, hud 90, timer 70, indicator 60, media 50, calendar 40
  updatedAt: number
  expiresAt?: number      // untuk hud/alert transien
  // render: compact (kapsul/bubble) + expanded (kartu)
}
```

Aturan tampilan:
1. Urutkan aktivitas aktif berdasarkan `priority` turun, lalu `updatedAt` turun.
2. **Maksimal 2 yang tampil di mode kompak** (meniru iPhone yang juga hanya menampilkan 2):
   - 0 aktivitas → kapsul jam
   - 1 → satu kapsul memanjang
   - 2 → kapsul utama + gelembung kedua terpisah (split)
3. Aktivitas ke-3 dan seterusnya tidak tampil di mode kompak. Mereka muncul sebagai halaman di mode melebar (pager dengan titik indikator, geser/klik), bersama halaman Home.
4. Klik kapsul/bubble → melebar ke kartu aktivitas itu. Pager untuk pindah ke aktivitas lain atau Home.
5. Alert (mis. timer selesai) otomatis melebar, bunyi chime, bertahan sampai di-dismiss atau ±30 detik.
6. Transisi pakai `layoutId` Framer Motion. **Jangan pakai `AnimatePresence mode="wait"`** untuk morph shared-element (pakai `popLayout` atau `sync`).

### Isi halaman Home (saat tidak ada aktivitas)
- Jam besar + tanggal
- Tombol cepat timer (5 / 15 / 25 menit + Pomodoro)
- Zona **File Shelf** (drop area + daftar item)
- (Opsional, fase lanjut) to-do ringkas, status baterai/Wi-Fi

### 5.1 Mode Droplet (auto-minimize saat di aplikasi lain)

Tujuan: saat pengguna bekerja di aplikasi lain, kapsul tidak mengganggu dan tidak memblokir area di bawahnya.

State tampilan: `capsule` (normal) → `droplet` → `hidden`.

1. **Konteks "app mode"**: jendela foreground milik aplikasi lain (bukan desktop/shell Explorer/taskbar) yang maximized atau fullscreen (termasuk borderless dan video fullscreen di browser). Deteksi berbasis event: `SetWinEventHook` (`EVENT_SYSTEM_FOREGROUND` dan perubahan lokasi jendela foreground), lalu `IsZoomed` atau bandingkan rect jendela dengan rect monitor. Hindari polling cepat. Verifikasi API ke dokumentasi.
2. **Masuk droplet**: di app mode, bila tidak ada interaksi dengan notch selama 10 detik (bisa diatur di Settings, default 10), kapsul menyusut dengan spring menjadi droplet. Interaksi = hover, klik, atau aktivitas baru.
3. **Bentuk droplet**: lingkaran kecil hitam sekitar 14px, border tipis, highlight halus seperti tetesan air, di posisi atas-tengah yang sama. Window ikut mengecil ke ukuran droplet + padding bayangan (sekitar 48×48) sehingga hampir tidak memblokir klik.
4. **Keluar droplet (dwell hover)**: kursor di atas droplet selama 2 detik (default, bisa diatur 1–3 detik) → kapsul muncul kembali dengan spring. Selama dwell tampilkan isyarat progres (riak/cincin yang membesar pelan) supaya pengguna tahu akan terbuka. Kursor keluar sebelum waktunya → batal tanpa efek. Klik langsung pada droplet = buka seketika.
5. Setelah muncul lewat hover: bila 10 detik tanpa interaksi → kembali jadi droplet. Keluar dari app mode (kembali ke desktop) → kapsul normal otomatis.
6. **Aktivitas saat droplet**: timer/musik aktif ditandai titik kecil pada droplet (oranye untuk timer, hijau untuk media), tanpa teks. **Alert** (timer selesai) tetap melebar otomatis dari droplet beserta chime, kecuali mode "Jangan ganggu" atau fullscreen eksklusif: di situ droplet hanya berdenyut halus sampai pengguna hover.
7. **Hidden**: fullscreen eksklusif (game D3D), mode presentasi, atau layar terkunci → sembunyikan total, bukan droplet. Gunakan `SHQueryUserNotificationState` atau setara.
8. Settings: aktif/nonaktif auto-droplet, durasi inaktif, durasi dwell, dan apakah berlaku untuk aplikasi yang tidak maximized.
9. Performa: tanpa polling cepat; tanpa animasi loop saat droplet diam (riak hanya berjalan saat dwell).

## 6. Fase pengerjaan

### Fase 0 — Migrasi fondasi
- Scaffold Tauri 2 di repo ini. Hapus `electron/`, `vite-plugin-electron*`, `electron`, `electron-builder` dari dependency/config.
- Port `src/` yang ada. Hapus sisa template: `App.css`, `hero.png`, `react.svg`, `vite.svg`.
- Window sesuai bagian 4 (frameless, transparan, always-on-top, skip taskbar), tray icon, single instance.
- **Acceptance**: `tauri dev` jalan; `tauri build` menghasilkan installer; kapsul tampil tengah atas; area di sekitar kapsul tidak memblokir aplikasi lain secara berarti; Quit lewat tray bekerja.

### Fase 1 — Kapsul jam + Home
- Kapsul jam (format 12/24 jam di Settings; update per menit kecuali "tampilkan detik" aktif, selaras batas menit).
- Klik → Home dengan koreografi resize bagian 4. Collapse via blur/Esc/inaktif.
- Hapus dev control bar dari build produksi (boleh dipertahankan di mode dev lewat flag).
- **Aturan first-run (wajib)**: instalasi baru HANYA menampilkan kapsul jam. Tidak boleh ada timer jalan atau musik/waveform palsu. Data demo prototipe (`musicActive`/`timerActive` = true, "Paper Sky", 14:52) hanya boleh ada di mode dev lewat flag (`import.meta.env.DEV` atau `?demo=1`), tidak pernah di build produksi. Timer baru ada kalau pengguna memulainya; musik baru ada kalau SMTC (Fase 4) benar-benar mendeteksi sesi media. Sebelum Fase 4 selesai, aktivitas musik tidak ditampilkan sama sekali.
- **Acceptance**: expand/collapse mulus; tidak ada animasi infinite saat collapsed; CPU idle ≈ 0; instalasi baru menampilkan jam saja; tidak ada kotak/bayangan terpotong di sekeliling kapsul (cek di wallpaper terang dan gelap).

### Fase 1b — Mode Droplet
- Kerjakan setelah sisa Fase 1 beres (kartu menutup saat fokus hilang, tanpa scrollbar), karena memakai logika fokus/inaktivitas yang sama.
- Implementasi bagian 5.1: deteksi app mode di Rust (event-driven), state `capsule`/`droplet`/`hidden`, dwell hover 2 detik dengan isyarat progres, window mengecil ke ukuran droplet.
- Titik indikator timer/media dan aturan alert disiapkan sebagai hook; diisi penuh saat Fase 2 dan 4.
- **Acceptance**: buka Chrome maximized → setelah 10 detik jadi droplet dan window ≤ sekitar 48×48; hover 2 detik → kapsul kembali; pindah ke desktop → kapsul normal; kursor keluar sebelum 2 detik → batal; video/game borderless fullscreen tidak terganggu; CPU idle tetap ≈ 0.

### Fase 2 — Timer + registry aktivitas
- Implementasi `core/activities.ts` + store.
- Timer berbasis **timestamp** (`endsAt`), bukan menghitung mundur dengan counter (tahan throttling, sleep, reload). Persist ke disk supaya pulih setelah restart.
- Preset 5/15/25, input durasi custom, pause/resume/reset/+1m, mode Pomodoro (fokus / istirahat pendek / istirahat panjang).
- Kapsul kompak menampilkan ring progres + mm:ss. Selesai → alert (bagian 5 poin 5) dengan chime (file audio bundel, volume di Settings).
- **Acceptance**: timer akurat setelah laptop sleep; selesai memunculkan alert; restart app tidak menghilangkan timer aktif.

### Fase 3 — File Shelf
- Drop file/folder ke kapsul/Home (event drag-drop window Tauri; catatan: pengaturan drag-drop di Windows menonaktifkan HTML5 DnD di webview, itu tidak masalah di sini).
- Simpan **referensi path** + metadata (nama, ukuran, isDir, addedAt); opsi di Settings untuk menyalin ke folder app data. Tandai item yang path-nya sudah hilang.
- Drag-**keluar** ke aplikasi lain (native drag dari sisi Rust; cek plugin komunitas seperti `tauri-plugin-drag` atau implementasi sendiri, nilai maintenance-nya dulu). Fallback: klik untuk buka, menu "Show in Explorer", "Copy path".
- Hapus per item, "Clear", batas jumlah item di Settings, tersimpan di disk.
- Saat file di-drag ke arah kapsul: kapsul melebar menampilkan "Drop here".
- **Acceptance**: file dan folder bisa masuk, bisa ditarik keluar ke Explorer/chat/email, bertahan setelah restart.

### Fase 4 — Musik (SMTC)
- `media.rs` memakai `GlobalSystemMediaTransportControlsSessionManager`. Berlangganan event (media properties, playback info, timeline, current session changed); **jangan polling**.
- Kirim ke frontend: judul, artis, status play/pause, posisi, durasi, thumbnail (cache per track).
- Progress di frontend diinterpolasi saat playing; koreksi dari event timeline.
- Kontrol: play/pause, next, previous, seek. Tombol next/previous = ganti lagu (bukan seek ±10 detik seperti prototipe).
- Pilih sesi: utamakan yang sedang playing; tangani banyak sesi (Spotify + browser).
- Waveform: animasi `transform: scaleY` saja, dan HANYA berjalan saat playing dan terlihat.
- **Acceptance**: Spotify desktop, YouTube di Chrome/Edge, dan player lokal terdeteksi; split dengan timer bekerja.

### Fase 5 — Multi-aktivitas & polish
- Terapkan penuh aturan bagian 5 (maks 2 kompak, sisanya pager).
- Mata Kuma saat idle lama (opsional via tray "Personality"): kedip dijadwalkan dengan `setTimeout` acak 3–6 detik, bukan animasi infinite; berhenti total saat window tersembunyi.
- Settings window sederhana, i18n EN + ID, aksesibilitas dasar (label tombol, fokus keyboard).
- GitHub Actions build release, ikon app, screenshot/GIF di README.

### Fase 6 — Pembeda (pilih sesuai selera, lihat bagian 12)

## 7. Budget performa (target, wajib diukur)

- Idle (hanya jam, collapsed): CPU ≈ 0% dalam 60 detik pengamatan di Task Manager.
- RAM total semua proses (app + msedgewebview2) di idle: catat hasil ukur di `docs/PERF.md`. Target awal < 100 MB; perbaiki bila lebih.
- Hanya animasi `transform` dan `opacity`. Dilarang: animasi `height`/`width` berulang, `backdrop-filter` di elemen opaque, `repeat: Infinity` pada elemen yang tidak terlihat.
- Tidak ada interval 1 detik saat tidak ada yang perlu di-update di layar.
- Hentikan semua timer render saat window tersembunyi (fullscreen app aktif).

## 8. Privasi & keamanan

- Tanpa telemetri, tanpa akun. Data (shelf, timer, setting) hanya di app data dir pengguna.
- Frontend hanya boleh memanggil command Rust yang di-whitelist; aktifkan capability Tauri seminimal mungkin.
- Fitur lirik (jika ditambah): hanya kirim judul, artis, durasi ke LRCLIB, wajib jelas di README/Settings, bisa dimatikan, beri atribusi LRCLIB.
- Jangan menyimpan atau mengirim isi file shelf; hanya path dan metadata.

## 9. Catatan dari prototipe Electron saat ini

Bug/kekurangan yang HARUS tidak terbawa ke versi baru:
- Handler mouse enter/leave dipasang di root `w-full h-full` (menangkap seluruh window). Digantikan window shrink-to-fit.
- `AnimatePresence mode="wait"` bertabrakan dengan `layoutId`.
- Animasi `height` infinite untuk waveform; `backdrop-blur-xl` pada elemen `bg-black`.
- Interval timer dibuat ulang tiap detik (`timerSeconds` di dependency); timer 0:00 tanpa state akhir.
- Dev control bar aktif default di produksi.
- Class Tailwind v4: `flex-shrink-0` → `shrink-0`; cek `bg-gradient-to-tr` → `bg-linear-to-tr`.
- Data hardcoded ("Paper Sky • Lumen Coast"): ganti dengan data nyata; untuk mock/dev pakai teks sendiri.

Boleh dipertahankan: tampilan kapsul hitam + border tipis, konstanta spring (stiffness 420, damping 32, mass 0.8), ide `layoutId`, mata kedip Kuma (dengan jadwal baru).

## 10. Struktur repo target

```
KumaNotch/
  AGENTS.md atau KUMANOTCH_SPEC.md   (dokumen ini)
  docs/DECISIONS.md   docs/PERF.md
  src/  src-tauri/  public/
  .github/workflows/release.yml
  README.md  LICENSE (MIT)
```

## 11. Checklist uji manual (tiap fase)

- Monitor ganda, scale 100%/125%/150%, ganti resolusi saat app jalan.
- Buka game/video fullscreen → kapsul tidak menutupi.
- Laptop sleep/resume saat timer jalan.
- Klik di sekitar kapsul tembus ke aplikasi di belakang.
- Restart app: timer aktif dan isi shelf pulih.
- Quit lewat tray; tidak ada proses `msedgewebview2` yatim tersisa.

## 12. Backlog ide pembeda

Urutan rekomendasi (dari paling berguna per biaya):
1. **Indikator mic/kamera** (titik hijau/oranye seperti iOS) saat aplikasi memakai mikrofon/kamera. Bisa dibaca dari `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\{microphone,webcam}` (nilai `LastUsedTimeStop` = 0 berarti sedang dipakai; verifikasi di mesin nyata).
2. **`kuma notify`**: CLI kecil/endpoint lokal (localhost atau named pipe) supaya developer bisa `npm run build && kuma notify "build selesai"` dan hasilnya muncul sebagai alert di kapsul.
3. **Clipboard history** (teks + gambar) sebagai halaman pager, dengan pin. Pelengkap shelf.
4. **Hitung mundur agenda** dari file ICS atau jadwal manual ("Kelas mulai 10 menit lagi").
5. **Pengingat jeda mata 20-20-20** dan statistik fokus Pomodoro harian.
6. Overlay volume/brightness/Caps Lock, baterai, Wi-Fi, headphone (pakai Core Audio/event sistem).
7. Lirik tersinkron via LRCLIB (opsional, lihat privasi).
8. Karakter Kuma yang bereaksi (tidur, merayakan timer selesai, mengingatkan istirahat).

## 13. Aturan kerja agent (ringkas)

- Satu fase, satu rangkaian commit; selalu pastikan `tsc`, `cargo check`, dan build berhasil sebelum menyatakan selesai.
- Laporkan di akhir tiap fase: apa yang selesai, apa yang belum, hasil ukur performa, dan keputusan yang diambil.
- Jangan menyatakan fitur berhasil kalau belum diuji di Windows sungguhan; tandai "belum diverifikasi" bila memang tidak bisa diuji.
- Pertahankan README jujur: jangan klaim di atas yang sudah terukur.
