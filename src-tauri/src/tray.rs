use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
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
    let autostart_label = if is_id { "Mulai otomatis saat Windows aktif" } else { "Start with Windows" };
    let quit_label = if is_id { "Keluar dari KumaNotch" } else { "Quit KumaNotch" };

    let autolaunch_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart_item = CheckMenuItemBuilder::with_id("autostart", autostart_label)
        .checked(autolaunch_enabled)
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", quit_label).build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
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
            if event.id.as_ref() == "quit" {
                app_handle.exit(0);
            } else if event.id.as_ref() == "autostart" {
                if let Ok(enabled) = app_handle.autolaunch().is_enabled() {
                    if enabled {
                        let _ = app_handle.autolaunch().disable();
                    } else {
                        let _ = app_handle.autolaunch().enable();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
