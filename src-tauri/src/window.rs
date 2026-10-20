use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

static CURRENT_OFFSET_X: AtomicI32 = AtomicI32::new(0);
static CURRENT_HIT_REGION: Mutex<Option<(i32, i32, i32, i32)>> = Mutex::new(None);

#[cfg(windows)]
use windows::Win32::Foundation::HWND;
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{CreateRectRgn, SetWindowRgn};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongW, SetWindowLongW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, SWP_FRAMECHANGED,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_BORDER, WS_CAPTION, WS_DLGFRAME,
    WS_EX_CLIENTEDGE, WS_EX_DLGMODALFRAME, WS_EX_STATICEDGE, WS_EX_WINDOWEDGE, WS_MAXIMIZEBOX,
    WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
};

#[cfg(windows)]
pub fn strip_window_decorations(hwnd: HWND) {
    unsafe {
        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        let stripped_style = style
            & !(WS_CAPTION.0
                | WS_THICKFRAME.0
                | WS_MINIMIZEBOX.0
                | WS_MAXIMIZEBOX.0
                | WS_SYSMENU.0
                | WS_BORDER.0
                | WS_DLGFRAME.0);
        let new_style = stripped_style | WS_POPUP.0;
        let _ = SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);

        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        let new_ex_style = ex_style
            & !(WS_EX_DLGMODALFRAME.0
                | WS_EX_WINDOWEDGE.0
                | WS_EX_CLIENTEDGE.0
                | WS_EX_STATICEDGE.0);
        let _ = SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex_style as i32);

        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

pub fn set_window_bounds(window: &tauri::WebviewWindow, x: i32, y: i32, width: u32, height: u32) {
    #[cfg(windows)]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = SetWindowPos(
                    HWND(hwnd.0 as _),
                    None,
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

pub fn calculate_hit_region_physical(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    scale_factor: f64,
) -> (i32, i32, i32, i32) {
    let phys_left = (x as f64 * scale_factor).round() as i32;
    let phys_top = (y as f64 * scale_factor).round() as i32;
    let phys_right = ((x + width) as f64 * scale_factor).round() as i32;
    let phys_bottom = ((y + height) as f64 * scale_factor).round() as i32;
    (phys_left, phys_top, phys_right, phys_bottom)
}

#[tauri::command]
pub fn set_hit_region(
    app: AppHandle,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    *CURRENT_HIT_REGION.lock().unwrap() = Some((x, y, width, height));

    #[cfg(windows)]
    {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(hwnd) = window.hwnd() {
                let scale_factor = window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .map(|m| m.scale_factor())
                    .unwrap_or(1.0);

                let is_visible = window.is_visible().unwrap_or(false);

                unsafe {
                    if width <= 0 || height <= 0 {
                        // Passing None resets window region (unclipped)
                        let _ = SetWindowRgn(HWND(hwnd.0 as _), None, is_visible);
                    } else {
                        let (phys_left, phys_top, phys_right, phys_bottom) =
                            calculate_hit_region_physical(x, y, width, height, scale_factor);

                        let hrgn = CreateRectRgn(phys_left, phys_top, phys_right, phys_bottom);
                        // Windows OS takes ownership of hrgn when passed to SetWindowRgn.
                        // bRedraw is set to is_visible so we NEVER repaint or wake a hidden window.
                        let _ = SetWindowRgn(HWND(hwnd.0 as _), Some(hrgn), is_visible);
                    }
                }
            }
        }
    }
    Ok(())
}

pub const STAGE_WIDTH: f64 = 460.0;
pub const STAGE_HEIGHT: f64 = 420.0;

#[tauri::command]
pub fn resize_island(_app: AppHandle, _width: f64, _height: f64) -> Result<(), String> {
    // Fixed stage architecture (Fase 8b): window is not resized per transition
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

            let stage_phys_width = (STAGE_WIDTH * scale_factor).round() as u32;
            let stage_phys_height = (STAGE_HEIGHT * scale_factor).round() as u32;

            let x = calculate_clamped_x(
                monitor_pos.x,
                monitor_size.width,
                stage_phys_width,
                scaled_offset,
                scale_factor,
            );
            let y = monitor_pos.y;

            set_window_bounds(&window, x, y, stage_phys_width, stage_phys_height);
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

            let stage_phys_width = (STAGE_WIDTH * scale_factor).round() as u32;
            let stage_phys_height = (STAGE_HEIGHT * scale_factor).round() as u32;
            let offset_x = CURRENT_OFFSET_X.load(Ordering::Relaxed);
            let x = calculate_clamped_x(
                monitor_pos.x,
                monitor_size.width,
                stage_phys_width,
                offset_x,
                scale_factor,
            );
            let y = monitor_pos.y;

            set_window_bounds(&window, x, y, stage_phys_width, stage_phys_height);

            // Initial hit region: centered idle capsule bbox with bubble margin (width ~280, height ~60)
            let init_w = 280.0;
            let init_h = 60.0;
            let init_x = (STAGE_WIDTH - init_w) / 2.0;
            let init_y = 0.0;

            if let Ok(hwnd) = window.hwnd() {
                #[cfg(windows)]
                {
                    strip_window_decorations(HWND(hwnd.0 as _));
                    unsafe {
                        let phys_left = (init_x * scale_factor).round() as i32;
                        let phys_top = (init_y * scale_factor).round() as i32;
                        let phys_right = ((init_x + init_w) * scale_factor).round() as i32;
                        let phys_bottom = ((init_y + init_h) * scale_factor).round() as i32;

                        let hrgn = CreateRectRgn(phys_left, phys_top, phys_right, phys_bottom);
                        let _ = SetWindowRgn(HWND(hwnd.0 as _), Some(hrgn), true);
                    }
                }
            }

            *CURRENT_HIT_REGION.lock().unwrap() =
                Some((init_x as i32, init_y as i32, init_w as i32, init_h as i32));

            let _ = window.show();
        } else {
            let _ = window.show();
        }
    }
    Ok(())
}

pub fn handle_monitor_or_dpi_changed(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    // Only update bounds and region if the window is currently visible!
    // NEVER show or unhide a hidden window (e.g. in D3D fullscreen or presentation mode)
    let is_visible = window.is_visible().unwrap_or(false);
    if !is_visible {
        return Ok(());
    }

    if let Some(monitor) = window.current_monitor().ok().flatten() {
        let scale_factor = monitor.scale_factor();
        let monitor_size = monitor.size();
        let monitor_pos = monitor.position();

        let stage_phys_width = (STAGE_WIDTH * scale_factor).round() as u32;
        let stage_phys_height = (STAGE_HEIGHT * scale_factor).round() as u32;
        let offset_x = CURRENT_OFFSET_X.load(Ordering::Relaxed);
        let x = calculate_clamped_x(
            monitor_pos.x,
            monitor_size.width,
            stage_phys_width,
            offset_x,
            scale_factor,
        );
        let y = monitor_pos.y;

        set_window_bounds(window, x, y, stage_phys_width, stage_phys_height);

        // Reapply hit region for current bounds safely
        if let Some(r) = CURRENT_HIT_REGION.lock().unwrap().as_ref() {
            let (l, t, r_right, b) = calculate_hit_region_physical(r.0, r.1, r.2, r.3, scale_factor);
            if let Ok(hwnd) = window.hwnd() {
                #[cfg(windows)]
                unsafe {
                    let hrgn = CreateRectRgn(l, t, r_right, b);
                    let _ = SetWindowRgn(HWND(hwnd.0 as _), Some(hrgn), true);
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_hit_region_physical_100_percent() {
        let (l, t, r, b) = calculate_hit_region_physical(162, 0, 136, 58, 1.0);
        assert_eq!(l, 162);
        assert_eq!(t, 0);
        assert_eq!(r, 298);
        assert_eq!(b, 58);
    }

    #[test]
    fn test_calculate_hit_region_physical_125_percent() {
        let (l, t, r, b) = calculate_hit_region_physical(162, 0, 136, 58, 1.25);
        assert_eq!(l, 203);
        assert_eq!(t, 0);
        assert_eq!(r, 373);
        assert_eq!(b, 73);
    }

    #[test]
    fn test_calculate_hit_region_physical_150_percent() {
        let (l, t, r, b) = calculate_hit_region_physical(162, 0, 136, 58, 1.5);
        assert_eq!(l, 243);
        assert_eq!(t, 0);
        assert_eq!(r, 447);
        assert_eq!(b, 87);
    }

    #[test]
    fn test_calculate_clamped_x_bounds() {
        // Monitor 1920x1080 at x=0, window width 460
        let centered = calculate_clamped_x(0, 1920, 460, 0, 1.0);
        assert_eq!(centered, (1920 - 460) / 2);

        // Offsets
        let right_offset = calculate_clamped_x(0, 1920, 460, 100, 1.0);
        assert_eq!(right_offset, (1920 - 460) / 2 + 100);

        // Clamp to right margin
        let extreme_right = calculate_clamped_x(0, 1920, 460, 5000, 1.0);
        assert_eq!(extreme_right, (1920 - 460) - 8);

        // Clamp to left margin
        let extreme_left = calculate_clamped_x(0, 1920, 460, -5000, 1.0);
        assert_eq!(extreme_left, 8);
    }

    #[test]
    #[cfg(windows)]
    fn test_win32_create_rect_rgn_validity() {
        unsafe {
            let hrgn = CreateRectRgn(0, 0, 200, 100);
            assert!(!hrgn.is_invalid(), "CreateRectRgn must return a valid HRGN handle");
            use windows::Win32::Graphics::Gdi::DeleteObject;
            let res = DeleteObject(windows::Win32::Graphics::Gdi::HGDIOBJ(hrgn.0));
            assert!(res.as_bool(), "HRGN must be deletable when not owned by window");
        }
    }
}

