use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter,
};
use tauri_plugin_autostart::ManagerExt;

#[cfg(windows)]
unsafe extern "system" {
    fn GetUserDefaultUILanguage() -> u16;
}

fn is_indonesian_locale() -> bool {
    #[cfg(windows)]
    {
        let lang_id = unsafe { GetUserDefaultUILanguage() };
        (lang_id & 0x03FF) == 0x0021
    }
    #[cfg(not(windows))]
    {
        false
    }
}

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let is_id = is_indonesian_locale();
    let settings_label = if is_id { "Pengaturan..." } else { "Settings..." };
    let personality_label = if is_id { "Personality (Mata Kuma)" } else { "Personality (Kuma Eyes)" };
    let autostart_label = if is_id { "Mulai otomatis saat Windows aktif" } else { "Start with Windows" };
    let quit_label = if is_id { "Keluar dari KumaNotch" } else { "Quit KumaNotch" };

    let settings_item = MenuItemBuilder::with_id("settings", settings_label).build(app)?;
    let personality_item = CheckMenuItemBuilder::with_id("personality", personality_label)
        .checked(true)
        .build(app)?;
    let autolaunch_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart_item = CheckMenuItemBuilder::with_id("autostart", autostart_label)
        .checked(autolaunch_enabled)
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", quit_label).build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &settings_item,
            &personality_item,
            &autostart_item,
            &separator,
            &quit_item,
        ])
        .build()?;

    let icon = tauri::include_image!("icons/tray.png");

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("KumaNotch")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app_handle, event| {
            match event.id.as_ref() {
                "quit" => {
                    app_handle.exit(0);
                }
                "settings" => {
                    let _ = app_handle.emit("open_settings", ());
                }
                "personality" => {
                    let _ = app_handle.emit("toggle_personality", ());
                }
                "autostart" => {
                    if let Ok(enabled) = app_handle.autolaunch().is_enabled() {
                        if enabled {
                            let _ = app_handle.autolaunch().disable();
                            let _ = app_handle.emit("autostart_changed", false);
                        } else {
                            let _ = app_handle.autolaunch().enable();
                            let _ = app_handle.emit("autostart_changed", true);
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
pub fn autostart_is_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn autostart_set(app: AppHandle, enable: bool) -> Result<bool, String> {
    if enable {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }
    let _ = app.emit("autostart_changed", enable);
    Ok(enable)
}
