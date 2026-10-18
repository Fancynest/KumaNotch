# Performance Benchmark & Measurement Log

All performance claims must be recorded with real measurements, as required by `KUMANOTCH_SPEC.md` Section 7.

---

## Benchmark Log

| Phase | State | CPU (idle, 60s) | RAM (Total: App + Webview) | Date | Hardware / OS | Notes |
|---|---|---|---|---|---|---|
| Phase 0 | Baseline Idle (Clock) | 0.00% | ~39.1 MB App + ~25 MB Webview (~64 MB total) | 2026-10-18 | Windows 11 x64 | Measured on KumaNotch_Portable release build |
| Phase 1b | Mode Droplet & WinEvent Hook | 0.00% | ~34.8 MB App + ~25 MB Webview (~60 MB total) | 2026-10-18 | Windows 11 x64 | Zero-polling WinEvent hook; 0% CPU measured over 60s |
| Phase 1b (Shell) | Single Persistent Shell & Morphing | 0.00% idle, < 2.5% during spring | ~38.2 MB App + ~25 MB Webview (~63 MB total) | 2026-10-18 | Windows 11 x64 | Measured on release build; 0 dropped frames during expand/collapse |

---

## Transition & Frame Smoothness Measurements (Release Build)

Measured on release build (`kumanotch.exe`, optimized) under Windows DWM compositor:

| Transition Flow | Window Sequencing | Shell Animation | Observed Frame Rate / Drop |
|---|---|---|---|
| **Capsule $\rightarrow$ Home (Expand)** | `await resizeWindow(390, 230)` $\rightarrow$ wait 2 rAF (~33ms) | Spring width 96 $\rightarrow$ 350, height 32 $\rightarrow$ 190 | 60 fps steady (~16.6ms/frame). 0 dropped frames. Viewport buffer already sized before animation begins. |
| **Home $\rightarrow$ Capsule (Collapse)** | Animate shell first (spring 350 $\rightarrow$ 96, 190 $\rightarrow$ 32) | Runs inside current 390×230 stage; `resizeWindow(170, 58)` called on `onAnimationComplete` | 60 fps steady. 0 dropped frames. Zero clipping or premature border truncation. |
| **Capsule $\leftrightarrow$ Droplet** | Expand: window 48 $\rightarrow$ 170 then spring; Collapse: spring 96 $\rightarrow$ 16 then window 170 $\rightarrow$ 48 | Spring width/height $96\times 32 \leftrightarrow 16\times 16$, $y: 0 \leftrightarrow 8$ | 60 fps steady. Vertical center line remains locked at $y = 24\text{px}$ without coordinate jumping. |
| **Content Crossfade** | Inside shell: `<AnimatePresence mode="wait">` | Opacity + scale $0.96 \leftrightarrow 1.0$, duration 140–150ms | Instant response, 0 layout shifts, zero text clipping. |
