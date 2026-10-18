# KumaNotch 🐻🏝️

> A fluid, ultra-lightweight Apple-style **Dynamic Island** for Windows. Built for smooth multitasking without lagging potato laptops.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Windows](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6.svg)

---

## ✨ Features

- **True Dynamic Island Aesthetic**: Jet black capsule with continuous squircle corners, subtle ring glow, and authentic iOS spring physics.
- **State-Based Dynamic Window Sizing**: Window dimensions shrink and expand per state to ensure minimal transparent area and zero unwanted click obstruction.
- **Split Island Multitasking**: When multiple activities run simultaneously (e.g. Music + Timer), the island cleanly splits into detached bubbles.
- **Interactive Expanded Cards**: Click on any activity bubble to smoothly expand into full media controls, clock home, or timer settings.
- **Ultra-Lightweight**: Minimal CPU (~0% idle) and RAM footprint, smooth 60/120fps animations powered by Framer Motion.
- **Native Windows Integration**: Built on Tauri 2 with Rust backend, system tray controls, and auto-start integration.

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
- **State**: Zustand
- **Icons**: Lucide React

---

## 📄 License

MIT License © 2026 Fancynest

