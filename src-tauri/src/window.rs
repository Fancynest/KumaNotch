use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[tauri::command]
pub fn resize_island(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();

            let target_width = (width * scale_factor).round() as u32;
            let target_height = (height * scale_factor).round() as u32;

            let x = ((monitor_size.width.saturating_sub(target_width)) / 2) as i32;
            let y = (8.0 * scale_factor).round() as i32;

            let _ = window.set_size(PhysicalSize::new(target_width, target_height));
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
    Ok(())
}

pub fn setup_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();

            let initial_width = (220.0 * scale_factor).round() as u32;
            let initial_height = (100.0 * scale_factor).round() as u32;
            let x = ((monitor_size.width.saturating_sub(initial_width)) / 2) as i32;
            let y = (8.0 * scale_factor).round() as i32;

            let _ = window.set_size(PhysicalSize::new(initial_width, initial_height));
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
    Ok(())
}
