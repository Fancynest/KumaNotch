use std::sync::atomic::{AtomicI32, Ordering};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

static CURRENT_OFFSET_X: AtomicI32 = AtomicI32::new(0);

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

fn calculate_clamped_x(
    monitor_pos_x: i32,
    monitor_width: u32,
    target_width: u32,
    offset_x: i32,
    scale_factor: f64,
) -> i32 {
    let center_x = monitor_pos_x + ((monitor_width.saturating_sub(target_width)) / 2) as i32;
    let margin = (8.0 * scale_factor).round() as i32;
    let min_x = monitor_pos_x + margin;
    let max_x = monitor_pos_x + (monitor_width.saturating_sub(target_width) as i32) - margin;
    if min_x > max_x {
        center_x
    } else {
        (center_x + offset_x).clamp(min_x, max_x)
    }
}

#[tauri::command]
pub fn resize_island(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten())
            .or_else(|| window.available_monitors().ok().and_then(|m| m.into_iter().next()));

        if let Some(monitor) = monitor {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();

            let target_width = (width * scale_factor).round() as u32;
            let target_height = (height * scale_factor).round() as u32;

            let offset_x = CURRENT_OFFSET_X.load(Ordering::Relaxed);
            let x = calculate_clamped_x(
                monitor_pos.x,
                monitor_size.width,
                target_width,
                offset_x,
                scale_factor,
            );
            let y = monitor_pos.y + (8.0 * scale_factor).round() as i32;

            set_window_bounds(&window, x, y, target_width, target_height);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_island_offset(app: AppHandle, offset_x: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten())
            .or_else(|| window.available_monitors().ok().and_then(|m| m.into_iter().next()));

        if let Some(monitor) = monitor {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();

            let scaled_offset = (offset_x * scale_factor).round() as i32;
            CURRENT_OFFSET_X.store(scaled_offset, Ordering::Relaxed);

            if let Ok(size) = window.inner_size() {
                let x = calculate_clamped_x(
                    monitor_pos.x,
                    monitor_size.width,
                    size.width,
                    scaled_offset,
                    scale_factor,
                );
                let y = monitor_pos.y + (8.0 * scale_factor).round() as i32;

                set_window_bounds(&window, x, y, size.width, size.height);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_island_offset(app: AppHandle) -> f64 {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale_factor = monitor.scale_factor();
            return (CURRENT_OFFSET_X.load(Ordering::Relaxed) as f64) / scale_factor;
        }
    }
    CURRENT_OFFSET_X.load(Ordering::Relaxed) as f64
}

#[tauri::command]
pub fn get_system_time_format() -> String {
    #[cfg(windows)]
    {
        unsafe extern "system" {
            fn GetLocaleInfoEx(
                lpLocaleName: *const u16,
                LCType: u32,
                lpLCData: *mut u16,
                cchData: i32,
            ) -> i32;
        }
        let mut buf = [0u16; 64];
        let len = unsafe {
            GetLocaleInfoEx(
                std::ptr::null(), // LOCALE_NAME_USER_DEFAULT
                0x00000079,       // LOCALE_SSHORTTIME
                buf.as_mut_ptr(),
                buf.len() as i32,
            )
        };
        if len > 0 {
            let s = String::from_utf16_lossy(&buf[..(len as usize).saturating_sub(1)]);
            if s.contains('H') {
                return "24h".to_string();
            } else if s.contains('h') {
                return "12h".to_string();
            }
        }
    }
    "auto".to_string()
}

pub fn setup_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten())
            .or_else(|| window.available_monitors().ok().and_then(|m| m.into_iter().next()));

        if let Some(monitor) = monitor {
            let scale_factor = monitor.scale_factor();
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();

            let initial_width = (170.0 * scale_factor).round() as u32;
            let initial_height = (58.0 * scale_factor).round() as u32;
            let offset_x = CURRENT_OFFSET_X.load(Ordering::Relaxed);
            let x = calculate_clamped_x(
                monitor_pos.x,
                monitor_size.width,
                initial_width,
                offset_x,
                scale_factor,
            );
            let y = monitor_pos.y + (8.0 * scale_factor).round() as i32;

            set_window_bounds(&window, x, y, initial_width, initial_height);
            let _ = window.show();
        } else {
            let _ = window.show();
        }
    }
    Ok(())
}

