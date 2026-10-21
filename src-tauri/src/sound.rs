use windows::Win32::Media::Audio::{
    PlaySoundW, SND_ALIAS, SND_ASYNC, SND_NODEFAULT, SND_PURGE, SND_SYSTEM,
};
use windows_core::{w, PCWSTR};

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
