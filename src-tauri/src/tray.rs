use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};
use tauri_plugin_autostart::ManagerExt;

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let autolaunch_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart_item = CheckMenuItemBuilder::with_id("autostart", "Start with Windows")
        .checked(autolaunch_enabled)
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit KumaNotch").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &autostart_item,
            &separator,
            &quit_item,
        ])
        .build()?;

    let icon = match app.default_window_icon() {
        Some(icon) => icon.clone(),
        None => return Ok(()),
    };

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
