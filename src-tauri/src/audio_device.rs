use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use windows_core::{implement, PCWSTR};
use windows::Win32::Foundation::PROPERTYKEY;
use windows::Win32::Media::Audio::{
    eConsole, eRender, EDataFlow, ERole, DEVICE_STATE, DEVICE_STATE_ACTIVE,
    DEVICE_STATE_DISABLED, DEVICE_STATE_NOTPRESENT, DEVICE_STATE_UNPLUGGED,
    IMMDevice, IMMDeviceEnumerator, IMMNotificationClient, IMMNotificationClient_Impl,
    MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
    STGM_READ,
};
use windows::Devices::Bluetooth::{BluetoothConnectionStatus, BluetoothDevice, BluetoothLEDevice};
use windows::Devices::Enumeration::{DeviceInformation, DeviceInformationUpdate, DeviceWatcher};
use windows::Foundation::TypedEventHandler;

#[derive(Clone, serde::Serialize, Debug)]
pub struct AudioDeviceEvent {
    pub event_type: String,  // "connected" | "disconnected"
    pub device_name: String, // Cleaned name, e.g. "OPPO Enco Buds3", "JBL Flip 6", "Keychron K2"
    pub device_type: String, // "tws" | "headphones" | "speaker" | "keyboard" | "mouse" | "phone" | "audio" | "bluetooth"
    pub is_bluetooth: bool,
    pub is_default: bool,
}

// PKEY_Device_FriendlyName: {a45c254e-df1c-4efd-8020-67d146a850e0}, 14
const PKEY_DEVICE_FRIENDLY_NAME: PROPERTYKEY = PROPERTYKEY {
    fmtid: windows_core::GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
    pid: 14,
};

// PKEY_Device_EnumeratorName: {a45c254e-df1c-4efd-8020-67d146a850e0}, 24
const PKEY_DEVICE_ENUMERATOR_NAME: PROPERTYKEY = PROPERTYKEY {
    fmtid: windows_core::GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
    pid: 24,
};

unsafe fn extract_prop_string(prop: &windows::Win32::System::Com::StructuredStorage::PROPVARIANT) -> Option<String> {
    unsafe {
        // Check if vt == VT_LPWSTR (31)
        if prop.Anonymous.Anonymous.vt.0 == 31 {
            let pwstr = prop.Anonymous.Anonymous.Anonymous.pwszVal;
            if !pwstr.is_null() {
                if let Ok(s) = pwstr.to_string() {
                    return Some(s);
                }
            }
        }
    }
    None
}

/// Cleans raw Windows device endpoint strings like:
/// "Headset (OPPO Enco Buds3 Hands-Free AG Audio)" -> "OPPO Enco Buds3"
/// "Headphones (WH-1000XM4 Stereo)" -> "WH-1000XM4"
/// "Speakers (Realtek(R) Audio)" -> "Realtek Audio"
pub fn clean_device_name(raw: &str) -> String {
    let mut s = raw.trim().to_string();

    // 1. If wrapped in "Descriptor (Device Name)", unwrap the device name
    if let (Some(open), Some(close)) = (s.find('('), s.rfind(')')) {
        if open < close {
            let prefix = s[..open].trim().to_lowercase();
            if prefix.starts_with("headset")
                || prefix.starts_with("headphones")
                || prefix.starts_with("speakers")
                || prefix.starts_with("speaker")
                || prefix.starts_with("audio")
            {
                s = s[open + 1..close].trim().to_string();
            }
        }
    }

    // 2. Strip Windows driver noise and transport suffixes
    let noise_patterns = [
        " Hands-Free AG Audio",
        " Hands-Free Audio",
        " Hands-Free HF Audio",
        " Hands-Free",
        " Stereo",
        " Avrcp Transport",
        " A2DP SNK",
        "(R)",
        "(TM)",
    ];

    for noise in &noise_patterns {
        s = s.replace(noise, "");
    }

    let trimmed = s.trim();
    if trimmed.is_empty() {
        raw.trim().to_string()
    } else {
        trimmed.to_string()
    }
}

/// Classifies device into distinct categories:
/// "tws" | "speaker" | "headphones" | "keyboard" | "mouse" | "phone" | "audio" | "bluetooth"
pub fn classify_device(name: &str, is_bluetooth: bool) -> String {
    let lower = name.to_lowercase();

    // 1. TWS / In-Ear Earbuds (Evaluated FIRST so "Headset (OPPO Enco Buds3)" is classified as TWS, not generic headset)
    const TWS_KEYWORDS: &[&str] = &[
        "buds", "earbud", "in-ear", "airpod", "enco", "freebud", "earphone",
        "linkbud", "tune flex", "tune beam", "tune bud", "wf-1000", "wf-c",
        "c500", "c700", "redmi bud", "galaxy bud", "pixel bud", "realme bud",
        "airdots", "soundcore liberty", "soundcore life p", "soundcore r"
    ];
    for kw in TWS_KEYWORDS {
        if lower.contains(kw) {
            return "tws".to_string();
        }
    }

    // 2. Bluetooth / Desk Speakers / Soundbars
    const SPEAKER_KEYWORDS: &[&str] = &[
        "speaker", "soundbar", "boombox", "soundlink", "flip", "charge",
        "clip", "partybox", "megaboom", "wonderboom", "soundcore motion",
        "soundcore boost", "soundcore mini", "soundcore flare", "echo dot",
        "nest audio", "homepod", "jbl go", "jbl clip", "jbl flip", "jbl charge",
        "jbl xtreme", "jbl boombox", "audio ball", "moncer go"
    ];
    for kw in SPEAKER_KEYWORDS {
        if lower.contains(kw) {
            return "speaker".to_string();
        }
    }

    // 3. Over-Ear / On-Ear Headphones & Headsets
    const HEADPHONE_KEYWORDS: &[&str] = &[
        "headphone", "headset", "over-ear", "on-ear", "wh-1000", "wh-ch",
        "quietcomfort", "qc35", "qc45", "qc ultra", "studio pro", "solo pro",
        "barracuda", "blackshark", "arctis", "kraken", "virtuoso", "cloud ii",
        "cloud alpha", "major iv", "major v", "bose 700"
    ];
    for kw in HEADPHONE_KEYWORDS {
        if lower.contains(kw) {
            return "headphones".to_string();
        }
    }

    // 4. Keyboards
    const KEYBOARD_KEYWORDS: &[&str] = &[
        "keyboard", "keychron", "k380", "k780", "k2", "k3", "k4", "k6", "k8",
        "anne pro", "magic keyboard", "mx keys", "craft", "nuphy", "epomaker",
        "ducky", "rk61", "rk84", "rexus kl", "kl150"
    ];
    for kw in KEYBOARD_KEYWORDS {
        if lower.contains(kw) {
            return "keyboard".to_string();
        }
    }

    // 5. Mice & Pointers
    const MOUSE_KEYWORDS: &[&str] = &[
        "mouse", "trackball", "touchpad", "magic mouse", "mx master",
        "mx anywhere", "g304", "g305", "g502", "superlight", "deathadder",
        "viper", "basilisk", "pebble", "ergonomic mouse"
    ];
    for kw in MOUSE_KEYWORDS {
        if lower.contains(kw) {
            return "mouse".to_string();
        }
    }

    // 6. Game Controllers / Gamepads
    const CONTROLLER_KEYWORDS: &[&str] = &[
        "controller", "gamepad", "xbox", "dualsense", "dualshock",
        "pro controller", "joy-con", "8bitdo", "wireless controller"
    ];
    for kw in CONTROLLER_KEYWORDS {
        if lower.contains(kw) {
            return "controller".to_string();
        }
    }

    // 7. Smartphones & Tablets
    const PHONE_KEYWORDS: &[&str] = &[
        "iphone", "ipad", "android", "galaxy", "pixel", "xiaomi", "redmi",
        "oppo", "vivo", "realme", "oneplus", "huawei", "honor", "poco",
        "phone", "smartphone", "handphone", "hp", "jisoo", "samsung", "tab"
    ];
    for kw in PHONE_KEYWORDS {
        if lower.contains(kw) {
            return "phone".to_string();
        }
    }

    // 8. Fallback
    if is_bluetooth {
        "bluetooth".to_string()
    } else {
        "audio".to_string()
    }
}

#[derive(Clone, Debug)]
pub struct DeviceStateRecord {
    pub current_state: String, // "connected" | "disconnected"
    pub last_state_change: Instant,
    pub flap_count: u32,
    pub cooldown_until: Option<Instant>,
}

pub type DeviceTrackerMap = Arc<Mutex<HashMap<String, DeviceStateRecord>>>;

pub fn is_notifiable_device(dev_type: &str) -> bool {
    // Only user-facing peripherals (audio endpoints and physical input controllers)
    // should pop up connection alerts.
    // Smartphones, tablets, and background BLE sensors are deliberately suppressed because
    // they flap connections periodically in the background for Phone Link, notifications, and telemetry.
    matches!(
        dev_type,
        "tws" | "headphones" | "speaker" | "speakers" | "keyboard" | "mouse" | "audio" | "controller"
    )
}

fn should_emit_device_event(
    tracker: &DeviceTrackerMap,
    device_name: &str,
    dev_type: &str,
    event_type: &str,
) -> bool {
    // 1. Filter out non-notifiable devices (phones, background BLE beacons)
    if !is_notifiable_device(dev_type) {
        log::debug!(
            "DeviceWatcher: Suppressing notification for non-peripheral '{}' ({})",
            device_name,
            dev_type
        );
        return false;
    }

    let now = Instant::now();
    let mut map = tracker.lock().unwrap();
    let record = map.entry(device_name.to_string()).or_insert_with(|| DeviceStateRecord {
        current_state: String::new(),
        last_state_change: now,
        flap_count: 0,
        cooldown_until: None,
    });

    // 2. Check if device is in anti-flapping cooldown
    if let Some(cooldown) = record.cooldown_until {
        if now < cooldown {
            log::debug!(
                "DeviceWatcher: Device '{}' in anti-flapping cooldown, suppressing {}",
                device_name,
                event_type
            );
            return false;
        } else {
            record.cooldown_until = None;
            record.flap_count = 0;
        }
    }

    // 3. Prevent duplicate same-state events
    if record.current_state == event_type {
        return false;
    }

    let elapsed = now.duration_since(record.last_state_change);

    // 4. Anti-flapping detection:
    // If a device disconnected and reconnected in < 3.5 seconds, or vice-versa
    if elapsed < std::time::Duration::from_millis(3500) {
        record.flap_count += 1;
        // If it flapped 2 or more times rapidly, silence it for 20 seconds
        if record.flap_count >= 2 {
            log::warn!(
                "DeviceWatcher: Connection flapping detected on '{}' ({} flips in {:?}), muting for 20s",
                device_name,
                record.flap_count,
                elapsed
            );
            record.cooldown_until = Some(now + std::time::Duration::from_secs(20));
            return false;
        }
    } else if elapsed > std::time::Duration::from_secs(10) {
        record.flap_count = 0;
    }

    // 5. Suppress ephemeral disconnects if connected for < 2.5 seconds
    if event_type == "disconnected" && record.current_state == "connected" && elapsed < std::time::Duration::from_millis(2500) {
        log::debug!(
            "DeviceWatcher: Suppressing transient disconnect for '{}' (connected for only {:?})",
            device_name,
            elapsed
        );
        record.current_state = "disconnected".to_string();
        record.last_state_change = now;
        return false;
    }

    record.current_state = event_type.to_string();
    record.last_state_change = now;
    true
}

fn read_device_info(device: &IMMDevice) -> (String, String, bool) {
    let mut raw_name = String::from("Audio Device");
    let mut is_bluetooth = false;

    unsafe {
        if let Ok(store) = device.OpenPropertyStore(STGM_READ) {
            // Read Friendly Name
            if let Ok(prop_val) = store.GetValue(&PKEY_DEVICE_FRIENDLY_NAME) {
                if let Some(val_str) = extract_prop_string(&prop_val) {
                    if !val_str.is_empty() {
                        raw_name = val_str;
                    }
                }
            }

            // Read Enumerator Name to identify Bluetooth
            if let Ok(prop_val) = store.GetValue(&PKEY_DEVICE_ENUMERATOR_NAME) {
                if let Some(val_str) = extract_prop_string(&prop_val) {
                    let enum_name = val_str.to_uppercase();
                    if enum_name.starts_with("BTH") {
                        is_bluetooth = true;
                    }
                }
            }
        }
    }

    let clean_name = clean_device_name(&raw_name);
    let dev_type = classify_device(&clean_name, is_bluetooth);

    (clean_name, dev_type, is_bluetooth)
}

#[implement(IMMNotificationClient)]
struct AudioNotificationClient {
    app_handle: AppHandle,
    enumerator: IMMDeviceEnumerator,
    is_initialized: Arc<AtomicBool>,
    last_device_id: Arc<Mutex<String>>,
    device_cache: Arc<Mutex<HashMap<String, (String, String, bool)>>>,
    tracker: DeviceTrackerMap,
}

impl IMMNotificationClient_Impl for AudioNotificationClient_Impl {
    fn OnDeviceStateChanged(&self, pwstrdeviceid: &PCWSTR, dwnewstate: DEVICE_STATE) -> windows_core::Result<()> {
        if !self.is_initialized.load(Ordering::Relaxed) {
            return Ok(());
        }

        let is_connected = dwnewstate == DEVICE_STATE_ACTIVE;
        let is_disconnected = dwnewstate == DEVICE_STATE_UNPLUGGED
            || dwnewstate == DEVICE_STATE_NOTPRESENT
            || dwnewstate == DEVICE_STATE_DISABLED;

        if !is_connected && !is_disconnected {
            return Ok(());
        }

        let dev_id_str = unsafe { pwstrdeviceid.to_string().unwrap_or_default() };
        let event_type = if is_connected { "connected" } else { "disconnected" };

        let (device_name, device_type, is_bluetooth) = if is_connected {
            let info = unsafe {
                if let Ok(device) = self.enumerator.GetDevice(*pwstrdeviceid) {
                    read_device_info(&device)
                } else {
                    ("Audio Device".to_string(), "audio".to_string(), false)
                }
            };
            self.device_cache.lock().unwrap().insert(dev_id_str, info.clone());
            info
        } else {
            let mut cache = self.device_cache.lock().unwrap();
            cache.remove(&dev_id_str).unwrap_or_else(|| {
                ("Audio Device".to_string(), "audio".to_string(), false)
            })
        };

        // Use unified anti-flapping and peripheral filter engine
        if !should_emit_device_event(&self.tracker, &device_name, &device_type, event_type) {
            return Ok(());
        }

        let payload = AudioDeviceEvent {
            event_type: event_type.to_string(),
            device_name,
            device_type,
            is_bluetooth,
            is_default: false,
        };

        let _ = self.app_handle.emit("audio_device_changed", payload);
        Ok(())
    }

    fn OnDeviceAdded(&self, pwstrdeviceid: &PCWSTR) -> windows_core::Result<()> {
        if !self.is_initialized.load(Ordering::Relaxed) {
            return Ok(());
        }

        let dev_id_str = unsafe { pwstrdeviceid.to_string().unwrap_or_default() };
        let (device_name, device_type, is_bluetooth) = unsafe {
            if let Ok(device) = self.enumerator.GetDevice(*pwstrdeviceid) {
                read_device_info(&device)
            } else {
                ("Audio Device".to_string(), "audio".to_string(), false)
            }
        };

        self.device_cache.lock().unwrap().insert(dev_id_str, (device_name.clone(), device_type.clone(), is_bluetooth));

        if !should_emit_device_event(&self.tracker, &device_name, &device_type, "connected") {
            return Ok(());
        }

        let payload = AudioDeviceEvent {
            event_type: "connected".to_string(),
            device_name,
            device_type,
            is_bluetooth,
            is_default: false,
        };

        let _ = self.app_handle.emit("audio_device_changed", payload);
        Ok(())
    }

    fn OnDeviceRemoved(&self, _pwstrdeviceid: &PCWSTR) -> windows_core::Result<()> {
        Ok(())
    }

    fn OnDefaultDeviceChanged(
        &self,
        flow: EDataFlow,
        role: ERole,
        pwstrdefaultdeviceid: &PCWSTR,
    ) -> windows_core::Result<()> {
        if !self.is_initialized.load(Ordering::Relaxed) {
            return Ok(());
        }

        // Only monitor audio output (render) default device
        if flow != eRender || role != eConsole {
            return Ok(());
        }

        let device_id = unsafe { pwstrdefaultdeviceid.to_string().unwrap_or_default() };
        {
            let mut last = self.last_device_id.lock().unwrap();
            if *last == device_id {
                return Ok(()); // Avoid duplicate notifications
            }
            *last = device_id;
        }

        let (device_name, device_type, is_bluetooth) = unsafe {
            if let Ok(device) = self.enumerator.GetDevice(*pwstrdefaultdeviceid) {
                read_device_info(&device)
            } else {
                ("Audio Output".to_string(), "audio".to_string(), false)
            }
        };

        if !should_emit_device_event(&self.tracker, &device_name, &device_type, "connected") {
            return Ok(());
        }

        let payload = AudioDeviceEvent {
            event_type: "connected".to_string(),
            device_name,
            device_type,
            is_bluetooth,
            is_default: true,
        };

        let _ = self.app_handle.emit("audio_device_changed", payload);
        Ok(())
    }

    fn OnPropertyValueChanged(
        &self,
        _pwstrdeviceid: &PCWSTR,
        _key: &PROPERTYKEY,
    ) -> windows_core::Result<()> {
        Ok(())
    }
}

pub fn start_audio_device_watcher(app_handle: AppHandle) {
    let global_tracker: DeviceTrackerMap = Arc::new(Mutex::new(HashMap::new()));

    // 1. Windows Core Audio Watcher (Endpoints, TWS, Headsets, Speakers, 3.5mm jack)
    let app_handle_audio = app_handle.clone();
    let audio_tracker = global_tracker.clone();
    thread::spawn(move || {
        unsafe {
            if CoInitializeEx(None, COINIT_MULTITHREADED).is_err() {
                log::warn!("AudioWatcher: CoInitializeEx failed");
                return;
            }

            let enumerator: Result<IMMDeviceEnumerator, _> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);

            let enumerator = match enumerator {
                Ok(e) => e,
                Err(err) => {
                    log::warn!("AudioWatcher: Failed to create MMDeviceEnumerator: {:?}", err);
                    CoUninitialize();
                    return;
                }
            };

            let is_initialized = Arc::new(AtomicBool::new(false));
            let last_device_id = Arc::new(Mutex::new(String::new()));
            let device_cache = Arc::new(Mutex::new(HashMap::new()));

            // Store initial default device ID to avoid false connect alert on app startup
            if let Ok(default_device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                if let Ok(id_pwstr) = default_device.GetId() {
                    if let Ok(id_str) = id_pwstr.to_string() {
                        *last_device_id.lock().unwrap() = id_str.clone();
                        let info = read_device_info(&default_device);
                        device_cache.lock().unwrap().insert(id_str, info);
                    }
                }
            }

            let client: IMMNotificationClient = AudioNotificationClient {
                app_handle: app_handle_audio,
                enumerator: enumerator.clone(),
                is_initialized: is_initialized.clone(),
                last_device_id: last_device_id.clone(),
                device_cache: device_cache.clone(),
                tracker: audio_tracker,
            }
            .into();

            if let Err(err) = enumerator.RegisterEndpointNotificationCallback(&client) {
                log::warn!("AudioWatcher: RegisterEndpointNotificationCallback failed: {:?}", err);
                CoUninitialize();
                return;
            }

            log::info!("AudioWatcher: Windows Core Audio endpoint listener registered");

            // Mark as initialized after 1.5 seconds so initial enumeration doesn't spam alerts
            thread::sleep(std::time::Duration::from_millis(1500));
            is_initialized.store(true, Ordering::Relaxed);

            // Keep the thread alive to retain the COM listener callback
            loop {
                thread::sleep(std::time::Duration::from_secs(3600));
            }
        }
    });

    // 2. WinRT Bluetooth Device Watcher (Keyboards, Mice, Gamepads, Bluetooth Audio)
    let app_handle_bt = app_handle.clone();
    let bt_tracker = global_tracker;
    thread::spawn(move || {
        let is_initialized = Arc::new(AtomicBool::new(false));
        let known_devices = Arc::new(Mutex::new(HashMap::<String, (String, String)>::new()));

        let start_one = |selector: windows_core::HSTRING| -> windows_core::Result<DeviceWatcher> {
            let watcher = DeviceInformation::CreateWatcherAqsFilter(&selector)?;
            let is_init = is_initialized.clone();
            let app = app_handle_bt.clone();
            let devs = known_devices.clone();
            let tracker = bt_tracker.clone();

            watcher.EnumerationCompleted(&TypedEventHandler::new({
                let is_init = is_init.clone();
                move |_, _| {
                    is_init.store(true, Ordering::Relaxed);
                    Ok(())
                }
            }))?;

            watcher.Added(&TypedEventHandler::new({
                let is_init = is_init.clone();
                let app = app.clone();
                let devs = devs.clone();
                let tracker = tracker.clone();
                move |_, info: windows_core::Ref<'_, DeviceInformation>| {
                    if let Some(info) = info.as_ref() {
                        let id = info.Id().map(|h| h.to_string()).unwrap_or_default();
                        let name_raw = info.Name().map(|h| h.to_string()).unwrap_or_default();
                        if id.is_empty() || name_raw.is_empty() {
                            return Ok(());
                        }

                        let clean_name = clean_device_name(&name_raw);
                        let dev_type = classify_device(&clean_name, true);

                        devs.lock().unwrap().insert(id.clone(), (clean_name.clone(), dev_type.clone()));

                        // Only notify if post-initialization (not initial scan)
                        if !is_init.load(Ordering::Relaxed) {
                            return Ok(());
                        }

                        if !should_emit_device_event(&tracker, &clean_name, &dev_type, "connected") {
                            return Ok(());
                        }

                        let payload = AudioDeviceEvent {
                            event_type: "connected".to_string(),
                            device_name: clean_name,
                            device_type: dev_type,
                            is_bluetooth: true,
                            is_default: false,
                        };
                        let _ = app.emit("audio_device_changed", payload);
                    }
                    Ok(())
                }
            }))?;

            watcher.Removed(&TypedEventHandler::new({
                let is_init = is_init.clone();
                let app = app.clone();
                let devs = devs.clone();
                let tracker = tracker.clone();
                move |_, update: windows_core::Ref<'_, DeviceInformationUpdate>| {
                    if !is_init.load(Ordering::Relaxed) {
                        return Ok(());
                    }
                    if let Some(update) = update.as_ref() {
                        let id = update.Id().map(|h| h.to_string()).unwrap_or_default();
                        let (name, dev_type) = {
                            let mut map = devs.lock().unwrap();
                            map.remove(&id).unwrap_or_else(|| {
                                ("Bluetooth Device".to_string(), "bluetooth".to_string())
                            })
                        };

                        if !should_emit_device_event(&tracker, &name, &dev_type, "disconnected") {
                            return Ok(());
                        }

                        let payload = AudioDeviceEvent {
                            event_type: "disconnected".to_string(),
                            device_name: name,
                            device_type: dev_type,
                            is_bluetooth: true,
                            is_default: false,
                        };
                        let _ = app.emit("audio_device_changed", payload);
                    }
                    Ok(())
                }
            }))?;

            watcher.Start()?;
            Ok(watcher)
        };

        let mut _watchers = Vec::new();
        if let Ok(selector) = BluetoothDevice::GetDeviceSelectorFromConnectionStatus(BluetoothConnectionStatus::Connected) {
            if let Ok(w) = start_one(selector) {
                _watchers.push(w);
            }
        }
        if let Ok(selector) = BluetoothLEDevice::GetDeviceSelectorFromConnectionStatus(BluetoothConnectionStatus::Connected) {
            if let Ok(w) = start_one(selector) {
                _watchers.push(w);
            }
        }

        log::info!("BluetoothWatcher: WinRT classic and BLE watchers active");

        loop {
            thread::sleep(std::time::Duration::from_secs(3600));
        }
    });
}
