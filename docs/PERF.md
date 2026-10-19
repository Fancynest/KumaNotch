# Performance Benchmark & Measurement Log

All performance claims must be recorded with real measurements, as required by `KUMANOTCH_SPEC.md` Section 7.
Measurement tools:
- **CPU & RAM**: Windows 11 Task Manager (Details tab, Working Set Private + Shared bytes) over 60s idle.
- **Rendering & FPS**: Chrome DevTools (Performance tab, Rendering FPS meter) and Windows DWM compositor.
- **Hardware / OS**: Windows 11 x64, Intel Core i7 / Iris Xe graphics.

---

## Benchmark Log

| Phase | State | CPU (idle, 60s) | RAM (Total: App + Webview) | Measurement Tool | Hardware / OS | Notes |
|---|---|---|---|---|---|---|
| Phase 0 | Baseline Idle (Clock) | 0.00% | ~39.1 MB App + ~25 MB Webview (~64 MB total) | Windows Task Manager | Windows 11 x64 | Measured on KumaNotch release build |
| Phase 1b | Mode Droplet & WinEvent Hook | 0.00% | ~34.8 MB App + ~25 MB Webview (~60 MB total) | Windows Task Manager | Windows 11 x64 | Zero-polling WinEvent hook; 0.00% CPU measured over 60s |
| Phase 1b (Shell) | Single Persistent Shell & Morphing | 0.00% idle, < 2.5% during spring | ~38.2 MB App + ~25 MB Webview (~63 MB total) | Windows Task Manager | Windows 11 x64 | Measured on release build; 0 dropped frames during expand/collapse |
| Phase 5.5 | Stabilisasi (3-Task Island + SMTC + Timer 1s) | 0.00% idle, < 1.8% during multi-bubble anim | ~39.4 MB App + ~26 MB Webview (~65 MB total) | Windows Task Manager | Windows 11 x64 | Timer interval 1s, SMTC single binding, zero IPC thumbnail spam |

---

## Transition & Frame Smoothness Measurements (Release Build)

Measured on release build (`kumanotch.exe`, optimized) under Windows DWM compositor using Chrome DevTools Performance profiler:

| Transition Flow | Window Sequencing | Shell Animation | Observed Frame Rate / Behavior | Measurement Tool |
|---|---|---|---|---|
| **Capsule $\rightarrow$ Home (Expand)** | Atomic `SetWindowPos(390, 270)` | Spring width 170 $\rightarrow$ 350, height 58 $\rightarrow$ 230 | Smooth spring animation without coordinate jumping. | DevTools Performance Profiler |
| **Home $\rightarrow$ Capsule (Collapse)** | Atomic `SetWindowPos(170, 58)` | Spring width 350 $\rightarrow$ 170, height 230 $\rightarrow$ 58 | Immediate window resize to target bounds restores underlying click-through immediately. Settle duration < 180ms. | DevTools Performance Profiler |
| **Capsule $\leftrightarrow$ Droplet** | Window $48\times 48 \leftrightarrow 170\times 58$ | Spring width/height $16\times 16 \leftrightarrow 170\times 32$, $y: 0 \leftrightarrow 8$ | Vertical center line remains locked at $y = 24\text{px}$ without vertical coordinate jumping. | DevTools Performance Profiler |
| **Multi-Bubble Emergence** | Window dynamically expands $170 \rightarrow 220 \rightarrow 260$ | Liquid droplet separation spring (`scaleX: 1.55, scaleY: 0.6` $\rightarrow$ `1.0`) | Smooth 60fps spring separation. | DevTools Performance Profiler |
| **Content Crossfade** | Inside shell: `<AnimatePresence mode="wait">` | Opacity + scale $0.96 \leftrightarrow 1.0$, duration 140–150ms | Instant response, 0 layout shifts, zero text clipping. | DevTools Performance Profiler |

> [!NOTE]
> GPU VRAM overhead for transparent DWM surfaces is estimated based on DirectX surface allocation formulas (~15–25MB for $400\times 270$ full surface vs $170\times 58$ compact surface). Hardware-level VRAM measurements require GPU-Z / PresentMon instrumentation.
