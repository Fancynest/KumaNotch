use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
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

#[derive(Clone, serde::Serialize, Debug)]
pub struct AudioDeviceEvent {
    pub event_type: String,  // "connected" | "disconnected"
    pub device_name: String, // e.g. "AirPods Pro", "Headphones", "Realtek Audio"
    pub device_type: String, // "bluetooth" | "headphones" | "speakers" | "audio"
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

fn read_device_info(device: &IMMDevice) -> (String, String) {
    let mut name = String::from("Audio Device");
    let mut dev_type = String::from("audio");

    unsafe {
        if let Ok(store) = device.OpenPropertyStore(STGM_READ) {
            // Read Friendly Name
            if let Ok(prop_val) = store.GetValue(&PKEY_DEVICE_FRIENDLY_NAME) {
                if let Some(val_str) = extract_prop_string(&prop_val) {
                    if !val_str.is_empty() {
                        name = val_str;
                    }
                }
            }

            // Read Enumerator Name to identify Bluetooth
            if let Ok(prop_val) = store.GetValue(&PKEY_DEVICE_ENUMERATOR_NAME) {
                if let Some(val_str) = extract_prop_string(&prop_val) {
                    let enum_name = val_str.to_uppercase();
                    if enum_name.starts_with("BTH") {
                        dev_type = String::from("bluetooth");
                    }
                }
            }
        }
    }

    if dev_type != "bluetooth" {
        let name_lower = name.to_lowercase();
        if name_lower.contains("headphone") || name_lower.contains("headset") || name_lower.contains("earphone") {
            dev_type = String::from("headphones");
        } else if name_lower.contains("speaker") {
            dev_type = String::from("speakers");
        }
    }

    (name, dev_type)
}

#[implement(IMMNotificationClient)]
struct AudioNotificationClient {
    app_handle: AppHandle,
    enumerator: IMMDeviceEnumerator,
    is_initialized: Arc<AtomicBool>,
    last_device_id: Arc<Mutex<String>>,
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

        let event_type = if is_connected {
            "connected"
        } else {
            "disconnected"
        };

        let (device_name, device_type) = unsafe {
            if let Ok(device) = self.enumerator.GetDevice(*pwstrdeviceid) {
                read_device_info(&device)
            } else {
                ("Audio Device".to_string(), "audio".to_string())
            }
        };

        let payload = AudioDeviceEvent {
            event_type: event_type.to_string(),
            device_name,
            device_type,
            is_default: false,
        };

        let _ = self.app_handle.emit("audio_device_changed", payload);
        Ok(())
    }

    fn OnDeviceAdded(&self, pwstrdeviceid: &PCWSTR) -> windows_core::Result<()> {
        if !self.is_initialized.load(Ordering::Relaxed) {
            return Ok(());
        }

        let (device_name, device_type) = unsafe {
            if let Ok(device) = self.enumerator.GetDevice(*pwstrdeviceid) {
                read_device_info(&device)
            } else {
                ("Audio Device".to_string(), "audio".to_string())
            }
        };

        let payload = AudioDeviceEvent {
            event_type: "connected".to_string(),
            device_name,
            device_type,
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

        let (device_name, device_type) = unsafe {
            if let Ok(device) = self.enumerator.GetDevice(*pwstrdefaultdeviceid) {
                read_device_info(&device)
            } else {
                ("Audio Output".to_string(), "audio".to_string())
            }
        };

        let payload = AudioDeviceEvent {
            event_type: "connected".to_string(),
            device_name,
            device_type,
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

            // Store initial default device ID to avoid false connect alert on app startup
            if let Ok(default_device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                if let Ok(id_pwstr) = default_device.GetId() {
                    if let Ok(id_str) = id_pwstr.to_string() {
                        *last_device_id.lock().unwrap() = id_str;
                    }
                }
            }

            let client: IMMNotificationClient = AudioNotificationClient {
                app_handle: app_handle.clone(),
                enumerator: enumerator.clone(),
                is_initialized: is_initialized.clone(),
                last_device_id: last_device_id.clone(),
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
}
