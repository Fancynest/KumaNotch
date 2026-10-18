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


