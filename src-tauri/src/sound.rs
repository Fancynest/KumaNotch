use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use windows::Win32::Foundation::S_OK;
use windows::Win32::Media::Audio::{
    eConsole, eRender, AudioSessionStateActive, IMMDeviceEnumerator, MMDeviceEnumerator, PlaySoundW,
    IAudioSessionControl2, IAudioSessionManager2, ISimpleAudioVolume, SND_ALIAS, SND_ASYNC,
    SND_NODEFAULT, SND_PURGE, SND_SYSTEM,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows_core::{w, Interface, PCWSTR};

struct DuckedSession {
    volume_control: ISimpleAudioVolume,
    original_volume: f32,
}

unsafe impl Send for DuckedSession {}
unsafe impl Sync for DuckedSession {}

static DUCKED_SESSIONS: OnceLock<Mutex<Vec<DuckedSession>>> = OnceLock::new();
static DUCK_EPOCH: OnceLock<Mutex<u64>> = OnceLock::new();

fn get_ducked_storage() -> &'static Mutex<Vec<DuckedSession>> {
    DUCKED_SESSIONS.get_or_init(|| Mutex::new(Vec::new()))
}

fn get_duck_epoch() -> &'static Mutex<u64> {
    DUCK_EPOCH.get_or_init(|| Mutex::new(0))
}

#[tauri::command]
pub fn play_system_sound(sound: Option<String>) -> bool {
    let sound_name = match sound.as_deref() {
        Some("alarm") | Some("notification") => w!("SystemNotification"),
        Some("exclamation") => w!("SystemExclamation"),
        Some("asterisk") => w!("SystemAsterisk"),
        Some("hand") => w!("SystemHand"),
        Some("question") => w!("SystemQuestion"),
        _ => w!("SystemNotification"),
    };

    unsafe {
        PlaySoundW(
            sound_name,
            None,
            SND_ALIAS | SND_ASYNC | SND_NODEFAULT | SND_SYSTEM,
        )
        .as_bool()
    }
}

#[tauri::command]
pub fn stop_system_sound() -> bool {
    unsafe {
        PlaySoundW(PCWSTR::null(), None, SND_PURGE | SND_ASYNC).as_bool()
    }
}

/// Temporarily ducks other application audio sessions (e.g. Spotify, Chrome, Edge)
/// down to `duck_factor` (default 0.20 = -80% volume) so timer alert sounds clearly.
#[tauri::command]
pub fn start_audio_ducking(duck_factor: Option<f32>) -> bool {
    let factor = duck_factor.unwrap_or(0.20).clamp(0.0, 1.0);
    let storage = get_ducked_storage();
    let epoch_lock = get_duck_epoch();

    let mut sessions_guard = match storage.lock() {
        Ok(guard) => guard,
        Err(_) => return false,
    };

    // If ducking is already active, do not re-duck (prevents recording ducked volume as original)
    if !sessions_guard.is_empty() {
        return true;
    }

    let current_epoch = {
        let mut ep = epoch_lock.lock().unwrap();
        *ep = ep.wrapping_add(1);
        *ep
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator_res: windows_core::Result<IMMDeviceEnumerator> =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);

        if let Ok(enumerator) = enumerator_res {
            if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                if let Ok(manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
                    if let Ok(session_enum) = manager.GetSessionEnumerator() {
                        let count = session_enum.GetCount().unwrap_or(0);
                        let my_pid = std::process::id();

                        for i in 0..count {
                            if let Ok(session_control) = session_enum.GetSession(i) {
                                if let Ok(state) = session_control.GetState() {
                                    if state == AudioSessionStateActive {
                                        if let Ok(control2) = session_control.cast::<IAudioSessionControl2>() {
                                            let pid = control2.GetProcessId().unwrap_or(0);
                                            let is_system = control2.IsSystemSoundsSession() == S_OK;

                                            if pid != my_pid && !is_system {
                                                if let Ok(simple_vol) = session_control.cast::<ISimpleAudioVolume>() {
                                                    if let Ok(original_vol) = simple_vol.GetMasterVolume() {
                                                        let target_vol = (original_vol * factor).clamp(0.0, 1.0);
                                                        if simple_vol.SetMasterVolume(target_vol, std::ptr::null()).is_ok() {
                                                            sessions_guard.push(DuckedSession {
                                                                volume_control: simple_vol,
                                                                original_volume: original_vol,
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        CoUninitialize();
    }

    drop(sessions_guard);

    // Watchdog thread: automatically restore original audio levels after 55s
    // to guarantee volume is never left ducked if an unexpected event occurs.
    thread::spawn(move || {
        thread::sleep(Duration::from_secs(55));
        let epoch = get_duck_epoch().lock().map(|ep| *ep).unwrap_or(0);
        if epoch == current_epoch {
            let _ = stop_audio_ducking();
        }
    });

    true
}

/// Restores all ducked audio sessions back to their exact original volume levels.
#[tauri::command]
pub fn stop_audio_ducking() -> bool {
    let storage = get_ducked_storage();
    let mut sessions_guard = match storage.lock() {
        Ok(guard) => guard,
        Err(_) => return false,
    };

    if sessions_guard.is_empty() {
        return true;
    }

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        for session in sessions_guard.drain(..) {
            let _ = session.volume_control.SetMasterVolume(session.original_volume, std::ptr::null());
        }
        CoUninitialize();
    }

    true
}
