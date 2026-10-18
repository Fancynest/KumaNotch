# KumaNotch 🐻🏝️

> A fluid, ultra-lightweight Apple-style **Dynamic Island** for Windows. Built for smooth multitasking without lagging potato laptops.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Windows](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6.svg)

---

## ✨ Features

- **True Dynamic Island Aesthetic**: Jet black capsule with continuous squircle corners, subtle glow, and authentic iOS spring physics (stiffness: 420, damping: 32).
- **Split Island Multitasking**: When multiple activities run simultaneously (e.g., Music + Timer), the island cleanly splits into detached compact bubbles.
- **Horizontal 3-Page Home Pager**:
  - **Page 0 (Music Player)**: Windows SMTC integration for Spotify, browsers, and media players with live playback controls, seek bar, and live track art.
  - **Page 1 (Clock & Quick Timer)**: Real-time clock respecting system 12h/24h format, quick timer presets (5m, 15m, 25m, Focus Session Pomodoro), and custom timer duration picker.
  - **Page 2 (File Shelf)**: Temporary file tray to drop files or folders. Seamlessly drag items back out into Explorer, Slack, Discord, or web browsers.
- **Mata Kuma ("Personality")**:
  - Displays cute blinking Kuma bear eyes when idle.
  - Scheduled with randomized intervals (3–6s) to ensure ~0% CPU usage without infinite render loops; automatically pauses when window is hidden.
- **Bilingual Settings & Customization**:
  - Full Indonesian and English localization.
  - Customizable time format (Auto, 12h, 24h), language, Auto-droplet timeout, dwell hover timeout, and personality toggle.
  - Windows autostart toggle synced with system tray.
  - Web Audio synthesized alarm chimes with volume control.
- **Auto-Droplet Mode**:
  - Automatically morphs into a tiny droplet when other applications are active.
  - Dwell hover (2s) or click smoothly springs back to the capsule.
- **Ultra-Lightweight**: Minimal CPU (~0% idle) and RAM footprint, smooth 60/120fps animations powered by Framer Motion.
- **Native Windows Integration**: Built on Tauri 2 with Rust backend, system tray controls, and auto-start integration.

---

## 🎮 Gestures & Shortcuts

| Action | Gesture / Shortcut |
|---|---|
| **Expand Home Card** | Click idle capsule |
| **Switch Pages (Music / Clock / Shelf)** | Mouse scroll wheel or horizontal swipe gesture |
| **Quick Settings** | Click gear icon in Clock header, or Tray menu |
| **Collapse Card** | Press <kbd>Escape</kbd>, click header arrow, or click outside |
| **Re-emerge from Droplet** | Hover cursor for 2 seconds (dwell), or click droplet |
| **Drop Files to Shelf** | Drag files or folders directly over the island |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/) (latest stable)
- C++ build tools (MSVC or MSYS2 MinGW-w64)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/Fancynest/KumaNotch.git
cd KumaNotch

# Install dependencies
npm install

# Run in development mode (with Tauri & Vite HMR)
npm run tauri dev
```

### Build Installer (`.exe` / `.msi`)

```bash
# Build standalone Windows installer and binary
npm run tauri build
```
The output installers will be generated in `src-tauri/target/release/bundle/`.

---

## 🛠️ Tech Stack

- **Runtime & Shell**: Tauri 2 (Rust + WebView2)
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion (Spring Physics)
- **Audio**: Web Audio API (Synthesized resonant chimes)
- **Icons**: Lucide React

---

## 📄 License

MIT License © 2026 Fancynest

