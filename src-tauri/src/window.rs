use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[cfg(windows)]
unsafe extern "system" {
    fn SetWindowPos(
        hwnd: isize,
        hwnd_insert_after: isize,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        flags: u32,
    ) -> i32;
}

const SWP_NOZORDER: u32 = 0x0004;
const SWP_NOACTIVATE: u32 = 0x0010;

pub fn set_window_bounds(window: &tauri::WebviewWindow, x: i32, y: i32, width: u32, height: u32) {
    #[cfg(windows)]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                SetWindowPos(
                    hwnd.0 as isize,
                    0,
                    x,
                    y,
                    width as i32,
                    height as i32,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                );
            }
            return;
        }
    }
    let _ = window.set_size(PhysicalSize::new(width, height));
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

#[tauri::command]
pub fn resize_island(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();

            let target_width = (width * scale_factor).round() as u32;
            let target_height = (height * scale_factor).round() as u32;

            let x = monitor_pos.x + ((monitor_size.width.saturating_sub(target_width)) / 2) as i32;
            let y = monitor_pos.y + (8.0 * scale_factor).round() as i32;

            set_window_bounds(&window, x, y, target_width, target_height);
        }
    }
    Ok(())
}

pub fn setup_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();

            let initial_width = (170.0 * scale_factor).round() as u32;
            let initial_height = (58.0 * scale_factor).round() as u32;
            let x = monitor_pos.x + ((monitor_size.width.saturating_sub(initial_width)) / 2) as i32;
            let y = monitor_pos.y + (8.0 * scale_factor).round() as i32;

            set_window_bounds(&window, x, y, initial_width, initial_height);
            let _ = window.show();
        } else {
            let _ = window.show();
        }
    }
    Ok(())
}

