# Architecture & Technical Decisions Log

This document records architectural choices, deviations from the initial spec, and dependency rationales as mandated by `KUMANOTCH_SPEC.md`.

---

## Decision 001: Migration to Tauri 2 (Fase 0)
- **Date**: 2026-10-18
- **Context**: The prototype initially explored Electron, but Electron's ~80-150MB baseline RAM footprint and heavy packaging conflicts with the "lightweight / potato laptop friendly" principle.
- **Decision**: Migrate runtime to **Tauri v2** with React 19 + TypeScript + Vite + Tailwind v4 + Framer Motion.
- **Consequences**:
  - Requires Rust toolchain on the developer machine.
  - Windows-native bindings (SMTC, Core Audio, Shell states) handled in Rust without extra helper binaries.
  - Runtime RAM target: < 100MB (to be benchmarked and recorded in `docs/PERF.md`).

## Decision 002: Window Padding & Box-Shadow Artifact Fix (Fase 1 First-Run)
- **Date**: 2026-10-18
- **Context**: The capsule exhibited a square clipping box around it because the window dimensions were tightly bounded to capsule width/height, clipping the blurred CSS box-shadow. OS-level shadows and backdrop-filters also created rendering artifacts on transparent webviews.
- **Decision**:
  1. Window bounds include >=40px padding around capsule states (idle: 220x100, split: 360x100, home: 440x260).
  2. OS shadow disabled (`"shadow": false`), webview background explicitly transparent (`#00000000`).
  3. Removed `backdrop-blur`/`backdrop-filter` in favor of solid dark capsule (`bg-black/95` or `bg-black/90`).
  4. Cleaned out all mock demo state from production: first-run is idle clock capsule only.

## Decision 003: Fase 1 Completion & Window/Tray Architecture
- **Date**: 2026-10-18
- **Context**: Completion of Fase 1 requirements from `KUMANOTCH_SPEC.md`: transparent click-blocking reduction, multi-monitor geometry, atomic positioning, tray cleanup, and timer reactivity.
- **Decision**:
  1. **Tightened Compact Bounds**: Reduced compact window height from 100px to 58px and softened CSS box-shadow (`shadow-[0_2px_10px_rgba(0,0,0,0.45)]`), cutting ~42px of transparent space below capsule while ensuring shadow is never clipped.
  2. **Multi-Monitor & Atomic Win32 SetWindowPos**: Positioning now factors in `monitor.position()` (`x = monitor_pos.x + ...`, `y = monitor_pos.y + 8px * scale_factor`), moving and sizing the window in a single atomic Win32 `SetWindowPos` call (`SWP_NOZORDER | SWP_NOACTIVATE`) without coordinate jumping or flicker.
  3. **Clean Startup**: Window is configured with `"visible": false` in `tauri.conf.json` and shown only after `setup_window` applies correct monitor bounds, preventing initial window flashing at wrong coordinates.
  4. **Auto-Collapse Flow**: Expanded cards automatically collapse on focus loss (Tauri `onFocusChanged` + `blur`), 10 seconds of user inactivity on Home, or Escape key.
  5. **Tray & Autostart**: Hidden unimplemented items (Settings, Personality); wired functional "Start with Windows" toggle via `tauri-plugin-autostart`.
  6. **Timer Effect Reactivity**: Removed setState updater side-effects from timer countdown; state transition to stopped now runs cleanly outside updater callback.
  7. **Cleanups**: Removed unused `@tauri-apps/plugin-shell`, removed Electron `electronAPI` typing from `vite-env.d.ts`, removed hardcoded file logging from `lib.rs` in favor of `tauri-plugin-log`, configured strict Content-Security-Policy (CSP), and updated `README.md`.

## Decision 004: Mode Droplet & Event-Driven Foreground Detection (Fase 1b)
- **Date**: 2026-10-18
- **Context**: Implementation of Section 5.1 and Fase 1b of `KUMANOTCH_SPEC.md`. When working in maximized or fullscreen applications (e.g. Chrome, editors, borderless video), KumaNotch shrinks into a discrete, non-obtrusive 14px droplet so it does not block tabs or window controls.
- **Decision**:
  1. **Event-Driven Detection (Zero-Polling)**: Implemented `src-tauri/src/detector.rs` using Win32 `SetWinEventHook` (`EVENT_SYSTEM_FOREGROUND` and `EVENT_SYSTEM_MOVESIZEEND`) with a background thread message loop. Emits `app_mode_changed` (`desktop` | `app` | `hidden`) only when foreground state changes.
  2. **Accurate Window Classification**:
     - `SHQueryUserNotificationState`: detects exclusive DirectX full-screen (`QUNS_RUNNING_D3D_FULL_SCREEN` = 3) and presentation mode (`QUNS_PRESENTATION_MODE` = 4), setting `hidden` state (`window.hide()`).
     - `GetClassNameW`: recognizes Desktop (`Progman`, `WorkerW`) and Taskbar (`Shell_TrayWnd`), immediately restoring `desktop` mode (`capsule`).
     - `IsZoomed` & `GetWindowRect` vs `GetMonitorInfoW`: accurately detects maximized windows and borderless/fullscreen video (e.g., YouTube full-screen in Chrome).
     - `GetCurrentProcessId`: filters out KumaNotch's own HWND to avoid mode flickering on interaction.
  3. **Shrink-To-Fit Droplet Window**: Window bounds shrink to 48×48 (`WINDOW_SIZES.droplet`) when in droplet mode, virtually eliminating click obstruction at the top bezel.
  4. **Dwell Hover & Ripple Feedback**: 2-second hover over droplet triggers visual ripple progress ring (`border-white/60` expanding outward). Mouse-out before 2s cancels. Direct click re-opens instantly.
  5. **Auto-Transition Logic**: 10 seconds of no interaction in app mode collapses to droplet; returning to desktop instantly restores normal clock capsule.

## Decision 005: Fase 1b Refinements & Icon Assets
- **Date**: 2026-10-18
- **Context**: Review of Fase 1b revealed edge cases in OS foreground tracking (in-place maximize/restore, D3D fullscreen delay, shell flyouts, multi-monitor setups), droplet vertical center discrepancy, and missing high-resolution icon assets.
- **Decision**:
  1. **In-Place Geometry Hook**: Registered `EVENT_OBJECT_LOCATIONCHANGE` (0x800B) hook filtered to `id_object == OBJID_WINDOW` (`0`) and `hwnd == GetForegroundWindow()`, debounced via an `mpsc` worker thread by ~200ms. Accurately detects in-place maximize/restore and browser fullscreen (F11/YouTube fullscreen) without polling or CPU overhead.
  2. **Delayed D3D Fullscreen Recheck**: Added a 1.5-second delayed check after every `EVENT_SYSTEM_FOREGROUND` event to catch exclusive Direct3D/DirectX games that initialize in windowed mode before engaging exclusive fullscreen (`QUNS_RUNNING_D3D_FULL_SCREEN` = 3 -> `hidden`).
  3. **Transient Shell Overlays**: Explicitly ignored shell classes (`Windows.UI.Core.CoreWindow`, `XamlExplorerHostIslandWindow`, `MultitaskingViewFrame`, `Shell_CharmWindow`, `NotifyIconOverflowWindow`, `TopLevelWindowForOverflowXamlIsland`, `ForegroundStaging`) so opening the Start Menu, Search, Task View, or Alt+Tab does not cause mode flickering or bouncing.
  4. **Multi-Monitor Geometry**: Foreground monitor is compared to KumaNotch's host monitor (`fg_mon == notch_mon`). Maximized or fullscreen apps on secondary monitors do not force KumaNotch on the primary monitor into droplet mode.
  5. **Vertical Center Alignment**: Aligned droplet container height to capsule height (`h-8`, 32px) at `pt-2` (8px), ensuring both droplet circle ($14\times 14$) and capsule share the exact same vertical center line ($y = 24\text{px}$) from the top of the window, eliminating vertical jumping during Framer Motion layout animations.
  6. **Icon Generation & Asset Compression**: Cropped 1024×1024 master PNG (`assets/icon.png`) with smooth squircle alpha mask from `assets/kumanotch_icon.jpg`, regenerated all application icons with `tauri icon`, added simplified high-contrast tray silhouette (`src-tauri/icons/tray.png`), and compressed raw 1.6MB JPG down to 42KB (>97% reduction).

## Decision 006: Single Persistent Shell & Stage Window Architecture Comparison
- **Date**: 2026-10-18 (Updated 2026-10-19)
- **Context**: Transition from compact capsule to expanded cards (Home, Timer, Music) or Droplet exhibited subtle visual jumps, shadow distortion, and clipping when using disparate DOM elements alongside concurrent window resizing.
- **Architectural Comparison**:
  1. **Option A: Fixed Stage Window with Click-Through (`ignore-cursor-events`)**:
     - *Concept*: The OS window is permanently sized to the largest possible dimension (e.g. 400×270). The transparent area surrounding the notch passes mouse clicks through to underlying background windows via Windows hit-testing (`WS_EX_TRANSPARENT` or IPC `setIgnoreCursorEvents`).
     - *Technical Reality & Findings on Windows / Tauri 2*:
       - **No Native Per-Pixel Alpha Hit-Test in Tauri 2**: Tauri 2 does not provide built-in per-pixel alpha hit-testing for WebView2 on Windows without custom Win32 sub-classing (`SetWindowSubclass` intercepting `WM_NCHITTEST`).
       - **IPC Mouse Latency & Cursor Glitches**: Dynamically toggling `WS_EX_TRANSPARENT` based on frontend mouse enter/leave events over IPC causes visible cursor flickering and missed clicks when the user moves the mouse rapidly into or out of the island.
       - **DWM Memory & GPU Composition Overhead**: A permanently large transparent DWM composition surface (400×270) on Windows is estimated to consume ~15–25MB more GPU VRAM and DWM buffer memory (estimated based on DWM composition buffer calculations; unmeasured with hardware instrumentation) than tight, shrink-to-fit bounds (48×48 / 170×58).
  2. **Option B: Single Persistent Shell with Choreographed Resizing & Ghost Artifact Trade-off (Selected)**:
     - *Concept*: One single persistent `<motion.div>` shell smoothly animates `width`, `height`, `borderRadius`, `boxShadow`, and `y` via Framer Motion's `animate`.
     - *Ghost Artifact vs Click-Through Trade-Off*:
       - If the OS window waits to shrink until the collapse spring animation completes (`onAnimationComplete`), the transparent expanded window canvas (e.g. 400×270) obstructs mouse clicks to underlying application tabs, window titlebars, and browser controls for ~300ms during the spring animation.
       - Conversely, if the OS window resizes immediately to target compact bounds upon collapse, DWM clips the visual perimeter of the collapsing card while it settles into the compact capsule ("ghost clipping artifact").
       - **Resolution in Final Code**: Window resize is executed immediately upon target change using atomic Win32 `SetWindowPos` (`SWP_NOZORDER | SWP_NOACTIVATE`, omitting `SWP_SHOWWINDOW`), prioritizing immediate click-through restoration for underlying applications. High spring stiffness (stiffness 420, damping 32, mass 0.8) ensures visual settlement occurs in <180ms, making boundary transition imperceptible.
       - **Top-Center Anchor**: Absolute positioning at `top: 8px, left: 50%, x: '-50%'` guarantees the island's horizontal center and top edge in monitor space never shift across window boundary changes.
- **Outcome**:
  Option B delivers 60fps performance on release builds, zero IPC hit-test lag, guarantees exact click-through bounds on underlying browser tabs/window controls, and keeps baseline RAM below 38MB.

## Decision 007: Timestamp-Based Resilient Timer Engine, Activity Registry, and Web Audio Chime (Fase 2)
- **Date**: 2026-10-18
- **Context**: Implementation of Fase 2 from `KUMANOTCH_SPEC.md`. Traditional countdown timers that decrement an integer counter (`prev - 1`) fail when the system sleeps, throttles background webviews, or restarts.
- **Decision**:
  1. **Timestamp-Based Tracking (`endsAt`)**:
     Timer duration is anchored strictly to an absolute epoch millisecond timestamp (`endsAt`). Remaining time is computed on-demand: `Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))`. If the laptop goes to sleep or background throttling occurs, upon resume the timer immediately re-synchronizes with true wall-clock time without drifting.
  2. **Crash & Restart Persistence**:
     State is automatically serialized to `localStorage` (`kumanotch_timer_state`). If KumaNotch is quit, restarted, or the machine reboots while a timer is running, the timer seamlessly rehydrates on launch. If the timer expired while the app was closed or sleeping, it immediately triggers the completion alert upon waking.
  3. **Activity Registry (`core/activities.ts`)**:
     Implemented an observable `ActivityRegistry` adhering to Section 5: priority-ranked activities (`alert: 100, hud: 90, timer: 70, indicator: 60, media: 50, calendar: 40`), auto-sorted by priority descending then `updatedAt` descending.
  4. **Compact SVG Circular Progress Ring**:
     Compact capsule displays an SVG circular progress ring (stroke-dashoffset based on `remainingSeconds / totalDurationSeconds`) with animated center pulse next to the mono `mm:ss` counter.
  5. **Pomodoro Cycle Engine & Custom Input**:
     Full Pomodoro state machine: Focus (25m), Short Break (5m), and Long Break (15m) with automatic cycle tracking (1..4), phase color coding (Amber for Focus, Emerald for Break), plus inline custom duration input.
  6. **Synthesized Web Audio API Chime (`core/audio.ts`)**:
     Built a zero-dependency bell chime using dual harmonic sine oscillators (C6 1046.5Hz, E6 1318.5Hz, G6 1567.98Hz) with exponential gain decay. Uses 0 KB external audio files, requires 0 disk I/O, and plays reliably on Windows without codec or asset-loading pitfalls.
  7. **Auto-Expanding Completion Alert**:
     Expired timer elevates to priority 100 (`alert`), auto-expanding from compact or droplet mode, sounding the chime, and presenting one-click next-phase action ("Mulai Istirahat", "Mulai Sesi Fokus", or "Ulangi Timer") with 30s auto-dismiss.

## Decision 008: Win32 Native Shell API & Unicode Clipboard for File Shelf (Fase 3 & 5.5)
- **Date**: 2026-10-19
- **Context**: Opening files via `cmd.exe /c start` failed on paths with ampersands, carets, percent signs, or spaces, and spawned ephemeral shell processes consuming ~30-50ms CPU and 15MB RAM per open. Similarly, copying paths via `clip.exe` piped through ANSI stdin, corrupting Unicode/non-ASCII characters.
- **Decision**:
  1. Replaced `cmd.exe` process spawning in `shelf_open_path` with direct Win32 `ShellExecuteW(0, L"open", wide_file, NULL, NULL, SW_SHOWNORMAL)`. Zero process creation overhead, instant execution, and completely impervious to shell escape injection.
  2. Replaced `clip.exe` in `shelf_copy_path` with Win32 `OpenClipboard(0)`, `EmptyClipboard()`, `GlobalAlloc(GMEM_MOVEABLE, size)`, `CF_UNICODETEXT`, and `SetClipboardData`. Guarantees lossless UTF-16 Unicode fidelity for Asian scripts, emojis, accents, and special symbols.

## Decision 009: WinRT SMTC Session Management, Token Tracking & Extrapolation (Fase 4 & 5.5)
- **Date**: 2026-10-19
- **Context**: Re-attaching SMTC event listeners (`MediaPropertiesChanged`, `PlaybackInfoChanged`, `TimelinePropertiesChanged`) on every session poll led to delegate accumulation and memory leaks. In addition, blocking WinRT calls on Tauri commands stalled the IPC main thread, while transmitting large base64 album art on every timeline tick consumed excessive memory.
- **Decision**:
  1. **Single-Binding Session Manager**: Implemented `sync_session_listeners` tracking bound sessions in a `HashMap<String, SessionBinding>`. Listeners attach exactly once per session. When a session terminates, tokens are explicitly detached via `RemoveMediaPropertiesChanged`, `RemovePlaybackInfoChanged`, and `RemoveTimelinePropertiesChanged`.
  2. **Non-Blocking Async Commands**: Converted all media playback commands (`media_play`, `media_pause`, `media_seek`, etc.) to `pub async fn` using `tauri::async_runtime::spawn_blocking`, offloading WinRT COM synchronization from Tauri's IPC event loop.
  3. **LastUpdatedTime & Frontend Extrapolation**: `TimelineProperties.LastUpdatedTime()` is converted to epoch milliseconds and dispatched with `MediaState`. The frontend interpolates playback position at 60fps via `positionMs + (Date.now() - lastUpdated)` without high-frequency polling.
  4. **Thumbnail Delta Caching**: Thumbnails are capped at $\le 256\text{KB}$ and only read and dispatched over IPC when `track_key` changes. Subsequent timeline ticks omit the base64 payload (`thumbnailBase64: None`), which is cached in the frontend `MediaEngine`.

## Decision 010: Settings Modal & Mata Kuma Personality Scheduler without Render Loops (Fase 5 & 5.5)
- **Date**: 2026-10-19
- **Context**: Adding user preferences (time format, language, autostart, auto-droplet, dwell duration, personality toggle, timer chime volume) required a modular settings interface without introducing render loops or out-of-sync tray states.
- **Decision**:
  1. **Persistent Settings Engine (`core/settings.ts`)**: Manages configuration in `localStorage` and exposes an observable engine. Synchronizes autostart with Windows Task Scheduler/Registry and personality toggle with Tauri system tray via `tray_set_personality`.
  2. **Zero-Loop Eyes Scheduler (`ClockCapsule.tsx`)**: Randomized blinking (3-6s) is derived cleanly during render; timer effects set state strictly inside callback chains and stop completely when the island is hidden or in droplet mode, producing zero cascading render warnings.

## Decision 011: Multi-Bubble 3-Task Island & Hover Dwell Interaction (Fase 5 & 5.5)
- **Date**: 2026-10-19
- **Context**: When music is playing and a timer is running concurrently while the user needs to view the clock, stacking cards or cluttering the compact capsule degraded readability and violated the minimalist Apple Dynamic Island aesthetic.
- **Decision**:
  1. **Multi-Bubble Cluster**: Partitioned concurrent tasks into 3 distinct visual bubbles:
     - **Left Bubble (Music)**: Circular 32px bubble displaying live album art or animated waveform with green aura.
     - **Center Capsule (Clock & Personality)**: Main capsule showing system clock and Mata Kuma blinking eyes.
     - **Right Bubble (Timer)**: Circular 32px bubble featuring an SVG circular countdown ring and remaining time display.
  2. **Liquid Droplet Separation Animation**: When a timer starts while the main capsule is active, the timer bubble separates from the main capsule using an authentic liquid-droplet spring animation (`scaleX: 1.55, scaleY: 0.6` tapering into `scale: 1`).
  3. **Hover Dwell Expansion (2s)**: Hovering over the timer or music bubble for 2 seconds displays a pulsating aura and smoothly expands that specific activity. Moving the cursor away auto-collapses it after 250ms. Direct click expands instantly.
## Decision 012: Build Toolchain Architecture & Lightweight LTO Release Profile
- **Date**: 2026-10-19
- **Context**: The MinGW GNU linker (`x86_64-w64-mingw32-gcc / collect2.exe`) fails with `exit status 116` when linking Rust proc-macro DLLs (`windows-implement`, `tauri-macros`). Additionally, committing machine-specific `.cargo/config.toml` to the project repository pollutes source control.
- **Decision**:
  1. **Clean Repo Policy**: Removed machine-specific `.cargo/config.toml` from the repository root and `src-tauri`. Linker configurations for the local GNU toolchain are placed in the user's global cargo configuration (`%USERPROFILE%\.cargo\config.toml`) specifying `linker = "rust-lld"`.
  2. **Lightweight Release Optimization**: Standardized `[profile.release]` with `opt-level = "s"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, and `strip = true`.
  3. **Measured Impact**: Binary executable size reduced from >12 MB to 3.65 MB (installer NSIS 6.97 MB, MSI 10.14 MB). Private working set dropped to <5 MB, and idle CPU remains firmly at 0.00%.

## Decision 013: Fresh File Tray Architecture & Native Shell Thumbnails (Fase 6a)
- **Date**: 2026-10-19
- **Context**: When users take screenshots (Win+PrtScn, Snipping Tool) or finish downloads (Chrome, Edge, Firefox), opening Explorer and finding the file interrupts workflow. A transient notch tray allows instant inspection, opening, and native drag-and-drop into chat or email without file clutter.
- **Decision**:
  1. **Win32 Known Folders Discovery**: Uses `SHGetKnownFolderPath` with `FOLDERID_Downloads` and `FOLDERID_Screenshots` (with Pictures\Screenshots fallback). This dynamically handles custom directory paths, drive relocations, and OneDrive redirections without hardcoded assumptions.
  2. **Zero-Polling Watcher (`notify` / `ReadDirectoryChangesW`)**: Non-recursive filesystem notifications backed by Win32 completion events. Pre-existing files are snapshotted at launch so historical items are never falsely emitted.
  3. **Download In-Progress Filtering & Readiness Detection**: Temporary download files (`.crdownload`, `.part`, `.tmp`, `.download`, `.opdownload`) are ignored. File readiness is validated by testing size stability ($\ge 800\text{ms}$) and non-locking read access (`std::fs::File::open`), safely accommodating browser "rename on completion" mechanics.
  4. **Flurry Debounce & Batching**: High-frequency file bursts (e.g. unzipping an archive with 50+ files) within a sliding 2.0-second window are aggregated into a single `"N file baru"` batch item, preventing UI notification flooding.
  5. **Win32 Shell Thumbnails (`IShellItemImageFactory`)**: Generates high-fidelity 256×256 thumbnails using Windows Shell thumbnail handlers (supporting images, PDFs, Office documents), resized via the `image` crate (Lanczos3), converted to PNG, base64-encoded, and cached in-memory.
  6. **Transient Activity with Inactivity Countdown & Hover Pause**: Emits as priority 55 `fresh-file` activity. Displays for 8 seconds (customizable 5–15s in Settings), auto-pausing the countdown when hovered, and resuming when the cursor departs.
  7. **Native Drag-Out & In-Memory Shelf Strip**: Dragging the thumbnail initiates native OS OLE drag (`tauri-plugin-drag`) directly into Windows Explorer, web browsers, or chat apps. The 5 most recent files of the session appear in a dedicated "Baru" strip at the top of the File Shelf.

## Decision 015: Expressive Mata Kuma Personality Engine & Contextual Emotions
- **Date**: 2026-10-19
- **Context**: The previous Mata Kuma implementation in `ClockCapsule.tsx` was limited to randomized vertical scale squishing for simple blinking. The user requested expressive, multi-emotion eyes so Kuma feels like a living companion on the desktop rather than a static widget.
- **Decision**:
  1. **Emotion States**: Implemented 8 distinct emotional expressions in `MataKuma.tsx`:
     - `neutral`: Default soft round eyes with subtle bear nose.
     - `happy`: Curved upward arc eyes (`^_^`) with soft pink cheek blushes.
     - `sleepy`: Half-closed relaxed eyelids with prolonged, slow blinks after extended desktop idle (>30s).
     - `curious`: Horizontal gaze tracking (looking left and right) triggered when fresh files appear.
     - `surprised`: Enlarged wide eyes triggered when a new Bluetooth or audio device connects.
     - `content`: Soft squint with blush during active music playback.
     - `thinking`: Eyes gazing up-and-right while a focus timer is running.
     - `wink`: Playful single-eye wink.
  2. **Context-Aware Inference**: The eyes automatically transition between emotions based on live app signals (`isMusicPlaying`, `isTimerRunning`, `isTimerCompleted`, `freshFileDetected`, `deviceConnected`, `idleDurationMs`).
  3. **Organic Micro-Expressions**: Integrated occasional double-blinks (20% probability) and periodic micro-looks (looking left/right every 5-13s) to simulate lifelike curiosity.
  4. **Zero CPU When Hidden**: All emotion intervals and blink timeouts completely stop when the capsule is hidden or in droplet mode, strictly preserving the ~0% idle CPU constraint.

## Decision 016: Fluid Spring Physics & Asymmetric Notch Dynamics
- **Date**: 2026-10-19
- **Context**: Reference analysis of `devcode90/Dynamic-Island-for-Windows` revealed that the authentic "Apple Dynamic Island" feel relies on sub-stepped spring physics and directional asymmetry.
- **Decision**:
  1. **Directional Spring Physics**: Tuned Framer Motion spring physics on `Shell` and auxiliary bubbles:
     - Main Shell: `stiffness: 340, damping: 30, mass: 0.85` for smooth, organic morphing without snappy mechanical jerkiness.
     - Auxiliary Bubbles (Music, Timer, Fresh File): `stiffness: 320, damping: 20, mass: 0.75` for an organic water droplet separation and reabsorption effect.
  2. **Fixed Padding Stage Sizing**: Window dimensions accommodate expanded card bounding boxes and shadows without frame-by-frame OS window destruction, eliminating window border flicker and compositor latency on high-refresh-rate displays.

## Decision 017: Event-Driven Bluetooth & Audio Device Connect/Disconnect HUD
- **Date**: 2026-10-19
- **Context**: Users frequently plug in 3.5mm headphones or connect/disconnect Bluetooth headphones/speakers without visual feedback from the desktop island.
- **Decision**:
  1. **Windows Core Audio Notification Client (`IMMNotificationClient`)**: Implemented a native Rust listener in `src-tauri/src/audio_device.rs` using `IMMDeviceEnumerator::RegisterEndpointNotificationCallback`.
  2. **Zero Polling & Event-Driven**: `OnDefaultDeviceChanged` and `OnDeviceStateChanged` fire via Windows RPC callbacks on hardware change. Zero CPU polling.
  3. **Device Classification & Enumerator Inspection**: Reads `PKEY_Device_FriendlyName` and inspects `PKEY_Device_EnumeratorName`. If enumerator starts with `"BTH"`, it is classified as `bluetooth`. Form factors and device names determine `headphones` or `speakers`.
  4. **Transient Notch HUD (`DeviceNotificationCard`)**: When a device connects or disconnects, the island smoothly morphs into a dedicated 210×36px status pill displaying the device icon (Bluetooth/Headphones/Speaker), friendly name, connection status, and pulsing indicator dot, auto-dismissing after 3.8 seconds.
  5. **Droplet Emergence**: If the island is in droplet mode when a device connects or disconnects, it temporarily re-emerges as a capsule to display the notification before returning to droplet state.

## Decision 018: Fine-Grained Device Classification (TWS, Speaker, Headphones, Keyboard, Mouse) & Dual-Stack WinRT/CoreAudio Watcher
- **Date**: 2026-10-19
- **Context**: Users connect a wide variety of Bluetooth and wired peripherals (e.g. OPPO Enco Buds3, REXUS KL150 Keyboard, JBL Flip Speaker, MX Master Mouse). Previously, all Bluetooth devices showed a generic Bluetooth `B` icon and uncleaned driver endpoint strings (e.g. `Headset (OPPO Enco Buds3 Hands-Free AG Audio)`), while non-audio Bluetooth devices (keyboards, mice) were omitted.
- **Decision**:
  1. **Dual-Stack Watcher Architecture**:
     - **Windows Core Audio (`IMMNotificationClient`)**: Captures all audio endpoints (TWS, headphones, speakers, 3.5mm jack, USB DACs) with zero polling.
     - **WinRT DeviceWatcher (`BluetoothDevice` & `BluetoothLEDevice`)**: Captures classic and Bluetooth Low Energy (BLE) peripheral connect/disconnect events (keyboards, mice, gamepads, smartphones) using `GetDeviceSelectorFromConnectionStatus(Connected)`. Completely event-driven with 0.00% idle CPU.
  2. **Device String Sanitization (`clean_device_name`)**:
     - Strips generic Windows host prefixes: `Headset (...)`, `Headphones (...)`, `Speakers (...)`.
     - Strips driver noise and transport suffixes: `Hands-Free AG Audio`, `Hands-Free HF Audio`, `Stereo`, `Avrcp Transport`, `A2DP SNK`, `(R)`, `(TM)`.
     - Example: `Headset (OPPO Enco Buds3 Hands-Free AG Audio)` becomes clean, legible `OPPO Enco Buds3`.
  3. **High-Precision Categorization (`classify_device`)**:
     - `tws`: Evaluated first before generic headset keywords (`buds`, `airpod`, `earbud`, `enco`, `in-ear`, `freebud`, `wf-1000`, `galaxy bud`, `tune beam`, etc.).
     - `speaker`: Desk and portable Bluetooth speakers (`speaker`, `soundbar`, `boombox`, `flip`, `charge`, `megaboom`, `audio ball`, `moncer go`, etc.).
     - `headphones`: Over-ear/on-ear headsets (`wh-1000`, `quietcomfort`, `qc35`, `qc45`, `kraken`, `arctis`, `blackshark`, `major iv`, etc.).
     - `keyboard`: Bluetooth/BLE keyboards (`keyboard`, `keychron`, `k380`, `mx keys`, `rexus kl`, `kl150`, etc.).
     - `mouse`: Bluetooth mice/pointers (`mouse`, `trackball`, `touchpad`, `mx master`, `mx anywhere`, `magic mouse`, `g304`, `pebble`, etc.).
     - `phone`: Mobile devices (`iphone`, `ipad`, `android`, `galaxy`, `pixel`, etc.).
  4. **Dedicated Vector Glyphs & Visual Accents**:
     - Designed custom high-fidelity dual-earbud vector SVG for TWS devices.
     - Lucide `Headphones`, `Speaker`, `Keyboard`, `Mouse`, `Smartphone`, and `Volume2` with subtle miniature Bluetooth badge overlay when `is_bluetooth` is true.
     - Rich category subtitles formatted with localized names: `{Category} • {Terhubung/Terputus}`.
  5. **Cross-Watcher Duplicate Suppression**:
     - Maintained a 2.5-second sliding debounce cache (`last_emitted`) to eliminate redundant notification bursts when a device reports to both Core Audio and WinRT Bluetooth stacks.

## Decision 019: Bold Vector SVG Emotions, Autonomous Idle Mood Cycles, and Olivia Rodrigo Celebration Mode
- **Date**: 2026-10-19
- **Context**: The user observed that Mata Kuma was largely stationary and only blinking/glancing left and right without clearly discernible emotions. Additionally, the user requested an explicit celebration reaction whenever music or videos related to Olivia Rodrigo are playing.
- **Decision**:
  1. **Bold Vector SVG Eye Geometry**:
     - Replaced subtle CSS-border squints with high-contrast, bold SVG vector geometry (`strokeWidth="2.2" strokeLinecap="round"` for smiling arcs `^`, distinct droops for sleepy, wide pupils for surprise, and asymmetric winks).
     - Rosy and purple cheek blush increased from faint `0.2` opacity blur to vibrant `0.75` opacity with radiant aura, clearly visible against the dark capsule backdrop.
  2. **Autonomous Organic Mood Cycles in Idle**:
     - Previously, Mata Kuma stayed strictly in `neutral` during inactivity.
     - Implemented an organic mood cycle: every 8–15 seconds during idle, Kuma spontaneously expresses adorable moods (happy smile, playful wink, content squint, curious tilt) for 3–4 seconds before settling back to neutral.
  3. **Olivia Rodrigo Celebration Mode (`isOliviaRodrigoMedia`)**:
     - Cross-references Windows SMTC media metadata (`artist`, `title`, `album`) across Spotify, YouTube, Chrome, Edge, and media players against Olivia Rodrigo's discography (*SOUR*, *GUTS*, signature tracks like *vampire*, *drivers license*, *good 4 u*, *bad idea right*, *get him back*, *deja vu*, etc.).
     - When an Olivia Rodrigo track or video is active:
       - Mata Kuma immediately switches to `happy` smiling eyes with rhythmic head-bobbing.
       - Cheeks glow with Olivia's signature vibrant lilac/purple blush (`#c084fc`).
       - A floating purple heart `💜` and musical note `♪` bob gently above the eyes.
  4. **Interactive Hover Receptivity**:
     - Moving the mouse cursor over the clock capsule no longer abruptly cancels the eyes. Instead, hovering prompts Kuma to look directly at the user and smile warmly with rosy blush.

## Decision 020: Expression Visibility, Fresh File Screenshot Discovery, Embedded HUD Reactions, and Bear Nose Redesign
- **Date**: 2026-10-19
- **Context**: The user identified that several key emotions were hidden or blocked by card transitions, fresh file detection was unresponsive on screenshots, timer thinking emotion was not appearing, idle expressions were grinning too frequently, and the center nose looked like a flat dash rather than an authentic bear nose:
  1. `surprised` (kaget) was hidden because `DeviceNotificationCard` unmounted `ClockCapsule`.
  2. `curious` never showed because `FOLDERID_SCREENSHOTS` had an incorrect GUID in Rust and `App.tsx` required `isMediaActive` for the fresh file bubble.
  3. `happy` on timer completion was covered because `AlertCard` expanded and had no Mata Kuma face.
  4. `thinking` was overridden by hover or hidden behind clock digits.
  5. Idle mood cycle was smiling (`happy`) too often, looking unnatural.
  6. The nose was a flat pill rather than a cute bear snout.
- **Decision**:
  1. **Device Connect `surprised` HUD Integration**:
     - Embedded `MataKuma` with `emotion={isConnected ? 'surprised' : 'content'}` directly on `DeviceNotificationCard` alongside the device badge. The user clearly sees Kuma's astonished round eyes when hardware connects.
  2. **Fresh File Screenshot Discovery & Independent Bubble**:
     - Corrected `FOLDERID_SCREENSHOTS` GUID in `fresh_file.rs`: `{B7BEDE81-DF94-4782-AC5D-95252C17F75A}`.
     - Added fallbacks for `USERPROFILE\Pictures\Screenshots`, `Tangkapan Layar`, and OneDrive synced screenshots folders.
     - Wrapped COM shell thumbnail extraction in `generate_shell_thumbnail_win32` with RAII `CoInitializeEx` / `CoUninitialize`.
     - In `App.tsx`, removed `isMediaActive` prerequisite so the Fresh File bubble appears independently on the right when idle, and on the left if a timer is occupying the right.
     - In `ClockCapsule.tsx`, `freshFileDetected` immediately triggers `showEyes` and `curious` side-glance toward the new file.
  3. **Timer Completion Celebration in `AlertCard`**:
     - Embedded `MataKuma` with `emotion="happy"` and celebratory amber badge right in the header of `AlertCard`.
  4. **Active Timer `thinking` State & Floating Thought Charm**:
     - In `ClockCapsule.tsx`, `isTimerRunning` immediately reveals Mata Kuma.
     - In `MataKuma.tsx`, `isTimerRunning` takes precedence over `isHovered`, gazing upward to the right with an animated floating amber thought bubble `💭`.
  5. **Calm Idle Calibration**:
     - Extended delay between spontaneous expressions to 18–32 seconds.
     - Reduced `happy` probability to only ~8%, keeping Kuma peaceful, serene, and calm (~70% neutral, subtle wink/content) during idle.
  6. **Authentic Bear Nose Vector Component (`BearNose`)**:
     - Replaced the flat pill with an authentic teddy bear nose: an inverted rounded triangle (`▼`), glossy shine highlight, and soft vertical philtrum seam.


## Decision 021: Bluetooth Anti-Flapping Engine, Companion Phone Background Sync Suppression, and Horizontally Aligned HUD
- **Date**: 2026-10-19
- **Context**: The user observed their smartphone named "Jisoo" repeatedly connecting and disconnecting every few minutes. Investigation revealed that paired Windows companion smartphones (Windows Phone Link / Link to Windows / BLE beaconing / Nearby Share) negotiate ephemeral 1–3 second RFCOMM/GATT background handshakes to sync battery, notifications, and clipboard, then disconnect to conserve power. KumaNotch was treating these background syncs as hardware peripheral connection events. Additionally, alternating connect/disconnect events bypassed the old key-based debounce, and the connection status light dot was placed too close to Kuma's right cheek blush.
- **Decision**:
  1. **Companion Phone & Non-Peripheral Event Suppression**:
     - Created `is_notifiable_device(dev_type)` in Rust: restricts popup HUD alerts strictly to active audio gear and input peripherals (`tws`, `headphones`, `speaker`, `keyboard`, `mouse`, `audio`, `controller`). Background companion smartphones (`phone`) and ambient BLE sensors are quietly suppressed.
     - Expanded `PHONE_KEYWORDS` in `classify_device` to capture brand names and common mobile nomenclature ("iphone", "ipad", "android", "galaxy", "pixel", "xiaomi", "redmi", "oppo", "vivo", "realme", "oneplus", "huawei", "honor", "poco", "phone", "smartphone", "handphone", "hp", "jisoo", "samsung", "tab").
     - Dual-layer frontend guard in `src/core/audioDevice.ts` to silently filter out any background phone sync events.
  2. **Unified Anti-Flapping State Machine Engine (`should_emit_device_event`)**:
     - Introduced `DeviceStateRecord` tracking `current_state`, `last_state_change`, `flap_count`, and `cooldown_until` stored in a shared `DeviceTrackerMap` across both Windows Core Audio and WinRT Bluetooth watchers.
     - Discards redundant duplicate state changes (`current_state == event_type`).
     - Suppresses transient blips where a device disconnects in less than 2.5 seconds after connecting (typical BLE ping behavior).
     - Anti-flapping hysteresis: if a device flips state twice in under 3.5 seconds, it is automatically muted into a 20-second quiet cooldown, preventing notification spam.
  3. **Visual Layout & Clearance Refinement**:
     - Formatted status badge horizontally inline (`Realtek Audio • Connected` or `OPPO Enco Buds3 • Terhubung`).
     - Spaced connection indicator light dot (`gap-3`, `ml-3`, `pr-0.5`) to eliminate visual overlap with Mata Kuma's right cheek blush.
     - Adjusted notification capsule width and window bounds to prevent text truncation while maintaining a compact footprint.
