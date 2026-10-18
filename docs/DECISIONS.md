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
