# Manual Testing Checklist & QA Protocol

This document provides a systematic manual testing checklist for KumaNotch, covering Win32 APIs, SMTC media transport, File Shelf unicode paths, OS foreground detection, fullscreen gaming, and multi-monitor setups.

---

## 1. WinRT SMTC Media Integration

### 1.1 Spotify Desktop App
- [ ] **Playback Detection**: Start Spotify and play a track.
  - Verify the **Left Music Bubble** (32px circular bubble with album artwork or animated audio waveform) appears to the left of the main capsule.
- [ ] **Artwork & Metadata**:
  - Verify track title, artist name, and album artwork render accurately on hover tooltip and inside Expanded Music.
  - Check network/CPU monitor: verify the thumbnail base64 string is only transferred over IPC when the track changes, not on continuous position ticks.
- [ ] **Media Controls**:
  - Click Play / Pause button in Expanded Music -> Spotify responds immediately.
  - Click Next Track / Previous Track -> track changes without latency.
  - Click on the progress bar to seek -> playback position jumps instantly in Spotify.
- [ ] **Position Extrapolation**:
  - Play a song and observe the progress bar in Expanded Music.
  - Verify smooth 60fps continuous progress without jitter or stutter, driven by `LastUpdatedTime` extrapolation.
- [ ] **Session Teardown**:
  - Close Spotify completely.
  - Verify listener handlers detach cleanly via session tokens in Rust logs without panic or memory leakage.
  - Verify Left Music Bubble smoothly exits with spring physics.

### 1.2 YouTube / Browser SMTC (Google Chrome & Microsoft Edge)
- [ ] **Browser Media Detection**:
  - Open a YouTube video in Google Chrome or Microsoft Edge.
  - Verify SMTC session is recognized and the media bubble appears.
- [ ] **Tab Switching & Closing**:
  - Pause or close the YouTube tab.
  - Verify KumaNotch transitions playback status to `paused` or `stopped` promptly.
  - Open and close multiple YouTube tabs: verify no duplicate event listener registrations accumulate.

---

## 2. File Shelf & Win32 Unicode File Operations

Create test files in a temporary directory with the following filename patterns:
- Special Shell Characters: `Report & Summary %2026^ final (v1).pdf`
- Asian & Accented Characters: `日本語のメモ_テスト.txt`, `한국어_보고서.docx`, `中文数据表_2026.xlsx`, `Café_Crème_Résumé.rtf`
- Emojis: `🐻 Kuma & 🎵 Soundtrack.mp3`

### 2.1 Drag & Drop Ingestion
- [ ] Drag the test files from Windows File Explorer onto KumaNotch.
- [ ] Verify KumaNotch transitions to the Amber `dropTarget` capsule with bounce animation.
- [ ] Release the drop: verify files are added to File Shelf and page 2 (File Shelf) opens automatically.

### 2.2 ShellExecuteW Execution
- [ ] Click the **Open** button (`ExternalLink` icon) on `Report & Summary %2026^ final (v1).pdf`.
  - **Expected**: Opens in the default PDF viewer immediately.
  - **Verification**: Ensure NO `cmd.exe` command prompt window flashes on the screen.
- [ ] Click the **Open** button on `日本語のメモ_テスト.txt`.
  - **Expected**: Opens cleanly in Notepad without "File not found" or character corruption errors.

### 2.3 Unicode Clipboard Copy (`shelf_copy_path`)
- [ ] Click the **Copy Path** button (`Copy` icon) on each test file:
  - Copy `日本語のメモ_テスト.txt`.
  - Copy `🐻 Kuma & 🎵 Soundtrack.mp3`.
- [ ] Open Windows Notepad and press `Ctrl+V`.
  - **Verification**: The full path must paste with 100% accurate Unicode characters without question marks (`?`), mojibake, or ANSI substitution.

### 2.4 File Explorer Location
- [ ] Click **Show in Folder** on a file shelf item.
  - **Expected**: Windows File Explorer opens and selects/highlights the exact target file.

---

## 3. OS Foreground Detection & Fullscreen Gaming

### 3.1 Desktop Mode
- [ ] Press `Win + D` or minimize all windows to show the desktop.
- [ ] Verify KumaNotch immediately restores to normal **Capsule** mode.

### 3.2 Maximized / Application Mode
- [ ] Open and maximize a browser or IDE.
- [ ] Wait for `inactivitySeconds` (default: 10s) without interacting with the notch.
- [ ] Verify the notch smoothly morphs into the minimal **14px Droplet**.
- [ ] Hover cursor over the Droplet:
  - Verify the pulsating ripple feedback ring expands outward for 2 seconds.
  - After 2 seconds of continuous hover, verify the capsule springs back open.
  - Move cursor away before 2 seconds: verify hover dwell cancels without opening.

### 3.3 Exclusive DirectX / Direct3D Fullscreen Games
- [ ] Launch a DirectX 11/12 or Vulkan game in exclusive fullscreen mode (e.g. Counter-Strike 2, Cyberpunk 2077, Valorant, or a fullscreen D3D benchmark like Unigine Superposition).
- [ ] **Verification**:
  - KumaNotch must detect `QUNS_RUNNING_D3D_FULL_SCREEN` and execute `window.hide()`.
  - The notch must be completely invisible and not intercept mouse clicks or overlay the game.
  - **Critical**: While the game is running, trigger a timer or media change in the background (or let a timer finish):
    - Verify `resize_island` does NOT force the window to show (`SWP_SHOWWINDOW` is absent).
    - The game display must remain uninterrupted.
- [ ] Exit or `Alt + Tab` out of the game:
  - Verify KumaNotch un-hides and restores its normal position on the desktop.

---

## 4. Multi-Monitor Geometry & Window Alignment

### 4.1 Primary Display Alignment
- [ ] With single or multiple monitors, verify KumaNotch launches centered horizontally on the primary monitor top bezel:
  - $x = \text{monitor.x} + (\text{monitor.width} - \text{window.width}) / 2$
  - $y = \text{monitor.y} + 8\text{px} \times \text{scale\_factor}$
- [ ] Verify DPI scaling (100%, 125%, 150%, 200%) renders sharp borders and fonts without clipping or blurriness.

### 4.2 Secondary Monitor Maximized Windows
- [ ] Move an application window (e.g. Chrome) to a secondary monitor and maximize it.
- [ ] Keep the primary monitor showing desktop or non-maximized windows.
- [ ] **Verification**: Because the foreground window is on a secondary monitor (`fg_mon != notch_mon`), KumaNotch on the primary monitor must NOT be forced into Droplet mode.

---

## 5. Multi-Bubble 3-Task Island & Hover Dwell Interaction

- [ ] **Setup 3 Tasks**:
  1. Play music in Spotify (Left Music Bubble active).
  2. Start a 5-minute timer (Right Timer Bubble active).
  3. Main capsule in center showing Clock and Mata Kuma eyes.
- [ ] **Liquid Droplet Animation**:
  - When starting a timer, observe the right bubble separating from the main capsule with a liquid droplet stretching spring animation.
- [ ] **Hover Dwell Interaction (2s)**:
  - Hover cursor over the **Right Timer Bubble**:
    - Observe the amber glowing aura expanding around the bubble.
    - After 2 seconds, verify the full Timer Card smoothly expands.
    - Move cursor out of the expanded card: verify it auto-collapses back into the bubble after 250ms.
  - Hover cursor over the **Left Music Bubble**:
    - Observe the green glowing aura expanding around the bubble.
    - After 2 seconds, verify the full Music Card smoothly expands.
    - Move cursor out: verify it auto-collapses back into the bubble after 250ms.
- [ ] **Direct Click**:
  - Click directly on the Music or Timer bubble: verify it expands immediately without waiting for the 2-second dwell timer.
