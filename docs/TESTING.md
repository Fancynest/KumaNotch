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

---

## 6. Fresh File Tray & Shell Thumbnails (Fase 6a)

### 6.1 Screenshot Detection (Win + PrtScn & Snipping Tool)
- [ ] Press `Win + PrtScn` to capture screen to `Pictures\Screenshots`.
  - **Expected**: Within ~1 second, KumaNotch displays the **Fresh File** notification with image thumbnail.
- [ ] Hover cursor over the notification:
  - **Expected**: Expands to Fresh File Card showing image preview, filename, file size, and action buttons.
- [ ] **Native Drag-Out**:
  - Click and drag directly from the thumbnail image in the Fresh File Card into:
    1. A folder in Windows File Explorer.
    2. A chat window in WhatsApp Web or Discord.
  - **Expected**: The physical file is transferred via OS drag-and-drop.
  - If "Dismiss on drag" is enabled in Settings, verify the card dismisses upon drag release.

### 6.2 Browser Download In-Progress Filtering (Chrome, Edge, Firefox)
- [ ] Start downloading a large file (e.g. 50MB+ ISO/ZIP/installer) in Google Chrome or Microsoft Edge.
  - **Expected**: During active download, `.crdownload` or `.tmp` file is completely ignored. KumaNotch does NOT trigger prematurely.
- [ ] Wait for download completion:
  - **Expected**: The moment the browser finishes and renames the file to its final extension, KumaNotch detects it within ~800ms and displays the thumbnail and metadata.

### 6.3 Flurry & Zip Extraction Debouncing
- [ ] Download or create a `.zip` archive containing 50+ files.
- [ ] Extract the archive directly into the `Downloads` directory.
  - **Expected**: KumaNotch aggregates the burst of 50+ events within 2.0 seconds into a single consolidated item (`"N file baru"`).
  - Verify the notch does NOT spam 50 individual cards or freeze the UI.

### 6.4 Inactivity Countdown & Hover Pause
- [ ] Trigger a fresh file (screenshot or download).
  - **Expected**: The card displays an 8-second animated timer indicator.
- [ ] Move cursor over the card:
  - **Expected**: Countdown immediately pauses. The card remains open indefinitely while hovered.
- [ ] Move cursor out of the card:
  - **Expected**: Countdown resumes from where it paused and cleanly auto-dismisses upon reaching 0.

### 6.5 Droplet Mode & Fullscreen Game Behavior
- [ ] In App/Droplet mode: trigger a screenshot with `Win + PrtScn`.
  - **Expected**: The droplet displays a small cyan indicator dot. It does NOT forcibly expand or steal window focus.
- [ ] In Fullscreen D3D game: trigger screenshot.
  - **Expected**: KumaNotch remains completely hidden and non-intrusive.

### 6.6 File Shelf "Baru" Strip
- [ ] Expand KumaNotch and switch to the **File Shelf** page.
  - **Expected**: A dedicated horizontal strip titled **Baru** appears at the top, listing up to 5 recently discovered files from this session.
- [ ] Click **+** (Add to Shelf) on an item in the "Baru" strip:
  - **Expected**: The item is permanently pinned to the persistent File Shelf.

### 6.7 Zero-Polling & Idle Resource Verification
- [ ] Open Windows Task Manager or Sysinternals Process Monitor.
- [ ] Filter to `kumanotch.exe`.
- [ ] Observe for 60 seconds with no file activity in Downloads or Screenshots.
  - **Expected**: 0 context switches from polling loops, CPU remains firmly at 0.00%.

---

## 7. Expressive Mata Kuma & Bluetooth/Audio Device HUD (Polish & Enhancements)

### 7.1 Expressive Mata Kuma Emotional Variations
- [ ] **Idle Eye Appearance**:
  - Keep cursor stationary for 6 seconds (or configured `idleBeforeEyesSeconds`).
  - **Expected**: Clock smoothly fades out and Mata Kuma bear eyes fade in.
- [ ] **Emotion: Sleepy**:
  - Leave desktop idle for >30 seconds.
  - **Expected**: Mata Kuma eyes relax into a sleepy, half-closed squint with slower, deeper blinks.
- [ ] **Emotion: Content / Happy (Music Playing)**:
  - Start playing music in Spotify or browser.
  - **Expected**: Eyes transition to curved joyful arcs (`^_^`) with soft pink cheek blushes.
- [ ] **Emotion: Thinking (Timer Running)**:
  - Start a Pomodoro or Quick Timer.
  - **Expected**: Eyes look thoughtfully up and to the right while timer is active.
- [ ] **Emotion: Curious (New File Arrived)**:
  - Take a screenshot with `Win + PrtScn`.
  - **Expected**: Mata Kuma looks inquisitively towards the left/right bubble.
- [ ] **Micro-Expressions & Double-Blinks**:
  - Observe eyes over a 30-second window.
  - **Expected**: Occasional double-blinks (~20% frequency) and subtle micro-looks (glancing left/right every 5–13 seconds) simulate living presence.

### 7.2 Bluetooth & Audio Device Connect / Disconnect HUD
- [ ] **TWS / Earbuds Connection (e.g. OPPO Enco Buds3, Galaxy Buds, AirPods)**:
  - Connect TWS earbuds.
  - **Expected**:
    1. Raw endpoint `Headset (OPPO Enco Buds3 Hands-Free AG Audio)` is cleanly sanitised to `OPPO Enco Buds3`.
    2. Displays dedicated **Dual Earbuds (TWS)** vector icon with sky-blue glowing border and Bluetooth badge.
    3. Subtitle displays `TWS • Terhubung` (or `TWS Earbuds • Connected`).
    4. Auto-dismisses after 3.8 seconds with smooth spring collapse.
- [ ] **Bluetooth Headphones Connection (e.g. Sony WH-1000XM, Bose QC)**:
  - Connect Bluetooth over-ear headphones.
  - **Expected**: Displays **Headphones** icon with sky-blue border, clean device name, and `Headphone • Terhubung`.
- [ ] **Bluetooth Speaker Connection (e.g. JBL Flip, Soundbar, MONCER GO)**:
  - Connect Bluetooth speaker.
  - **Expected**: Displays **Speaker** icon with sky-blue border, clean device name, and `Speaker • Terhubung`.
- [ ] **Bluetooth Keyboard Connection (e.g. REXUS KL150, Keychron, Logitech K380)**:
  - Connect Bluetooth or BLE keyboard.
  - **Expected**: WinRT Bluetooth watcher captures peripheral connect; displays **Keyboard** icon and `Keyboard • Terhubung`.
- [ ] **Bluetooth Mouse Connection (e.g. Logitech MX Master, Magic Mouse)**:
  - Connect Bluetooth mouse.
  - **Expected**: WinRT Bluetooth watcher captures peripheral connect; displays **Mouse** icon and `Mouse • Terhubung`.
- [ ] **3.5mm Headphone Jack / Wired Audio Plug-In**:
  - Plug 3.5mm headphones or USB DAC into audio port.
  - **Expected**: Displays green glowing aura, **Headphones** / **Volume2** icon without Bluetooth badge, and `Audio • Terhubung`.
- [ ] **Device Disconnection**:
  - Disconnect or turn off any connected peripheral.
  - **Expected**: Displays muted grey status pill showing `{Category} • Terputus` and the sanitized device name.
- [ ] **Dev Mode Simulation (Browser Dev)**:
  - Click any device button in the bottom floating toolbar (`TWS`, `Headphones`, `Speaker`, `Keyboard`, `Mouse`).
  - **Expected**: Fires instant mock event, expanding the pill with full animation and matching icon.
- [ ] **Zero-Polling Hardware Verification**:
  - Observe CPU in Process Explorer when no audio/Bluetooth device changes occur.
  - **Expected**: Windows RPC callbacks and WinRT watchers remain idle; zero CPU consumption (~0.00%).

### 7.3 Olivia Rodrigo Mode & Autonomous Idle Mood Cycles
- [ ] **Olivia Rodrigo Song / Video Detection (Live Media)**:
  - Play any song by Olivia Rodrigo on Spotify, YouTube, Chrome, or Windows Media Player (e.g. *vampire*, *drivers license*, *good 4 u*, *bad idea right?*, *get him back!*, *deja vu*).
  - **Expected**:
    1. Mata Kuma instantly awakens into the **Happy** smiling arc emotion (`^_^`).
    2. Vibrant lilac/purple blush (`#c084fc`) glows on both cheeks.
    3. Floating purple heart `💜` and music note `♪` bob gently above the eyes.
    4. Eyes rhythmically bop to the music (`y: [0, -1.8, 0]`).
- [ ] **Dev Mode Olivia Simulation**:
  - In browser dev mode, click the **💜 Olivia** button in the floating toolbar.
  - **Expected**: Immediately triggers Olivia Rodrigo state; Kuma beams with purple blush and joyful bobbing.
- [ ] **Autonomous Mood Cycles in Idle**:
  - Leave desktop sitting with Mata Kuma active and no active music or timers.
  - Observe over a 60–90 second period.
  - **Expected**: Kuma remains mostly calm and serene in neutral (~70% of the time). Every 18–32 seconds, Kuma gently expresses a subtle mood (content squint, subtle wink, or curious glance) without constantly grinning.
- [ ] **Interactive Hover Receptivity**:
  - Move the cursor directly over the ClockCapsule in idle view.
  - **Expected**: Eyes appear immediately (without waiting for idle timeout) and smile warmly at the user with pink blush.

### 7.4 Expression Visibility, Bear Nose, & HUD Embedded Reactions
- [ ] **Teddy Bear Nose (Kuma Snout)**:
  - Inspect Mata Kuma in any state (idle, thinking, curious, surprised).
  - **Expected**: Center nose renders an authentic cute bear nose (inverted rounded triangle `▼` with glossy shine highlight and vertical philtrum seam), replacing the old flat dash.
- [ ] **Surprised Reaction on Device Connect HUD**:
  - Connect any Bluetooth or audio peripheral (e.g. TWS, headphone).
  - **Expected**: Inside `DeviceNotificationCard` on the right side, Mata Kuma renders wide-eyed `surprised` eyes (`type="wide"` pupils) reacting directly to the new hardware.
- [ ] **Curious Reaction & Independent Fresh File Bubble**:
  - Take a screenshot with `Win + PrtScn` or Snipping Tool with Spotify paused.
  - **Expected**:
    1. Fresh File watcher detects the new screenshot in `Pictures\Screenshots`.
    2. Fresh File bubble appears immediately on the right side with thumbnail preview and sky-blue ring.
    3. Mata Kuma glances inquisitively toward the file (`curious` emotion).
- [ ] **Thinking Emotion with Floating Thought Charm on Active Timer**:
  - Start a Quick Timer or Pomodoro session.
  - **Expected**:
    1. Mata Kuma awakens immediately in `ClockCapsule`.
    2. Eyes gaze upward to the right in deep concentration (`thinking` emotion).
    3. An animated floating thought bubble `💭` pulses gently above Kuma.
    4. Hovering mouse over Kuma maintains the `thinking` state instead of falsely overriding to `happy`.
- [ ] **Happy Celebration in Alert Card on Timer Completion**:
  - Let a timer reach 00:00 (or trigger completed state).
  - **Expected**:
    1. `AlertCard` expands to full notification size with bell chime.
    2. In the card header, Mata Kuma is prominently rendered with `happy` smiling arcs `^_^` and celebratory rosy cheeks, celebrating the completed session.


