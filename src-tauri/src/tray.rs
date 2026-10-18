use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
    let autostart_item = CheckMenuItemBuilder::with_id("autostart", "Start with Windows")
        .checked(false)
        .build(app)?;
    let personality_item = CheckMenuItemBuilder::with_id("personality", "Personality (Kuma Eyes)")
        .checked(true)
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit KumaNotch").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &settings_item,
            &autostart_item,
            &personality_item,
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
            }
        })
        .build(app)?;

    Ok(())
}
