# KumaNotch 🐻🏝️

> A fluid, ultra-lightweight Apple-style **Dynamic Island** for Windows. Built for smooth multitasking without lagging potato laptops.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Windows](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6.svg)

---

## ✨ Features

- **True Dynamic Island Aesthetic**: Jet black capsule with continuous squircle corners, subtle ring glow, and authentic iOS spring physics.
- **Split Island Multitasking**: When multiple tasks run simultaneously (e.g. Music + Timer), the island cleanly splits into two detached bubbles.
- **Click-Through / Mouse Pass-Through**: Transparent regions pass all mouse clicks directly to underlying windows so your workflow is never interrupted.
- **Interactive Expanded Cards**: Click on any activity bubble to smoothly expand into full media controls or timer settings.
- **Ultra-Lightweight**: Minimal CPU and RAM footprint, smooth 60/120fps animations powered by Framer Motion.
- **Executable Output**: Builds into standalone `.exe` binaries for easy distribution.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or pnpm

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/Fancynest/KumaNotch.git
cd KumaNotch

# Install dependencies
npm install

# Run in development mode (with Hot Module Replacement)
npm run dev
```

### Build Executable (`.exe`)

```bash
# Build standalone Windows executable
npm run dist
```
The output `.exe` will be located in the `release/` directory.

---

## 🛠️ Tech Stack

- **Framework**: Electron + Vite
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion (Spring Physics)
- **Icons**: Lucide React

---

## 📄 License

MIT License © 2026 Fancynest
