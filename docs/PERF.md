# Performance Benchmark & Measurement Log

All performance claims must be recorded with real measurements, as required by `KUMANOTCH_SPEC.md` Section 7.

---

## Benchmark Log

| Phase | State | CPU (idle, 60s) | RAM (Total: App + Webview) | Date | Hardware / OS | Notes |
|---|---|---|---|---|---|---|
| Phase 0 | Baseline Idle (Clock) | 0.00% | ~39.1 MB App + ~25 MB Webview (~64 MB total) | 2026-10-18 | Windows 11 x64 | Measured on KumaNotch_Portable release build |
| Phase 1b | Mode Droplet & WinEvent Hook | 0.00% | ~34.8 MB App + ~25 MB Webview (~60 MB total) | 2026-10-18 | Windows 11 x64 | Zero-polling WinEvent hook; 0% CPU measured over 60s |
