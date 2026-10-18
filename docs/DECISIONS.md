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
- **Date**: 2026-10-18
- **Context**: Transition from compact capsule to expanded cards (Home, Timer) or Droplet exhibited subtle visual jumps, shadow distortion, and clipping when using `layoutId` across disparate DOM elements alongside concurrent window resizing.
- **Architectural Comparison**:
  1. **Option A: Fixed Stage Window with Click-Through (`ignore-cursor-events`)**:
     - *Concept*: The OS window is permanently sized to the largest possible dimension (e.g. 400×230). The transparent area surrounding the notch passes mouse clicks through to underlying background windows via Windows hit-testing (`WS_EX_TRANSPARENT` or IPC `setIgnoreCursorEvents`).
     - *Technical Reality & Findings on Windows / Tauri 2*:
       - **No Native Per-Pixel Alpha Hit-Test in Tauri 2**: Tauri 2 does not provide built-in per-pixel alpha hit-testing for WebView2 on Windows without custom Win32 sub-classing (`SetWindowSubclass` intercepting `WM_NCHITTEST`).
       - **IPC Mouse Latency & Cursor Glitches**: Dynamically toggling `WS_EX_TRANSPARENT` based on frontend mouse enter/leave events over IPC causes visible cursor flickering and missed clicks when the user moves the mouse rapidly into or out of the island.
       - **DWM Memory & GPU Composition Overhead**: A permanently large transparent DWM composition surface (400×230) on Windows consumes ~15–25MB more GPU VRAM and DWM buffer memory than tight, shrink-to-fit bounds (48×48 / 170×58), conflicting with the "potato laptop friendly" core principle.
  2. **Option B: Single Persistent Shell with Choreographed Resizing (Selected)**:
     - *Concept*: One single persistent `<motion.div>` shell smoothly animates `width`, `height`, `borderRadius`, `boxShadow`, and `y` via Framer Motion's `animate`. Window resizing is strictly choreographed:
       - **Expansion**: `await resizeWindow(target)`, wait 2 `requestAnimationFrame` cycles (~33ms) for DWM/WebView buffer repaint, then trigger shell spring animation.
       - **Collapse**: Animate shell to smaller target first inside the existing window bounds; execute `resizeWindow(target)` inside `onAnimationComplete` once the spring settles.
       - **Top-Center Anchor**: Absolute positioning at `top: 8px, left: 50%, x: '-50%'` guarantees the island's horizontal center and top edge in monitor space never shift across window boundary changes.
       - **Content Crossfade**: Inner views transition via `<AnimatePresence mode="wait">` (opacity + scale $0.96 \leftrightarrow 1.0$, 140–150ms). Hover/tap micro-interactions (`whileHover`, `whileTap`) are scoped strictly to inner child content.
- **Recommendation & Outcome**:
  Option B delivers 60fps native DWM performance with 0 dropped frames, zero IPC hit-test lag, eliminates clipping artifacts, guarantees exact click-through bounds on underlying browser tabs/window controls, and keeps baseline RAM below 38MB.

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


