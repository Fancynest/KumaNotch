use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, serde::Serialize)]
pub struct AppModePayload {
    pub mode: String, // "desktop", "app", "hidden"
}

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static LAST_MODE: AtomicU8 = AtomicU8::new(0); // 0: unset, 1: desktop, 2: app, 3: hidden

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct RECT {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct POINT {
    pub x: i32,
    pub y: i32,
}

#[repr(C)]
pub struct MSG {
    pub hwnd: isize,
    pub message: u32,
    pub wparam: usize,
    pub lparam: isize,
    pub time: u32,
    pub pt: POINT,
}

#[repr(C)]
pub struct MONITORINFO {
    pub cb_size: u32,
    pub rc_monitor: RECT,
    pub rc_work: RECT,
    pub dw_flags: u32,
}

pub type WINEVENTPROC = Option<
    unsafe extern "system" fn(
        h_win_event_hook: isize,
        event: u32,
        hwnd: isize,
        id_object: i32,
        id_child: i32,
        id_event_thread: u32,
        dwms_event_time: u32,
    ),
>;

const EVENT_SYSTEM_FOREGROUND: u32 = 0x0003;
const EVENT_SYSTEM_MOVESIZEEND: u32 = 0x000B;
const WINEVENT_OUTOFCONTEXT: u32 = 0x0000;
const WINEVENT_SKIPOWNPROCESS: u32 = 0x0002;
const MONITOR_DEFAULTTONEAREST: u32 = 2;

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn SetWinEventHook(
        event_min: u32,
        event_max: u32,
        hmod_win_event_proc: isize,
        pfn_win_event_proc: WINEVENTPROC,
        id_process: u32,
        id_thread: u32,
        dw_flags: u32,
    ) -> isize;
    fn UnhookWinEvent(h_win_event_hook: isize) -> i32;
    fn GetForegroundWindow() -> isize;
    fn GetClassNameW(hwnd: isize, lp_class_name: *mut u16, n_max_count: i32) -> i32;
    fn IsZoomed(hwnd: isize) -> i32;
    fn GetWindowRect(hwnd: isize, lp_rect: *mut RECT) -> i32;
    fn MonitorFromWindow(hwnd: isize, dw_flags: u32) -> isize;
    fn GetMonitorInfoW(h_monitor: isize, lpmi: *mut MONITORINFO) -> i32;
    fn GetMessageW(lp_msg: *mut MSG, hwnd: isize, w_msg_filter_min: u32, w_msg_filter_max: u32) -> i32;
    fn TranslateMessage(lp_msg: *const MSG) -> i32;
    fn DispatchMessageW(lp_msg: *const MSG) -> isize;
    fn GetWindowThreadProcessId(hwnd: isize, lpdw_process_id: *mut u32) -> u32;
    fn GetCurrentProcessId() -> u32;
    fn IsWindowVisible(hwnd: isize) -> i32;
}

#[cfg(windows)]
#[link(name = "shell32")]
unsafe extern "system" {
    fn SHQueryUserNotificationState(pquns: *mut i32) -> i32;
}

pub fn query_foreground_mode() -> &'static str {
    #[cfg(windows)]
    unsafe {
        // 1. Check SHQueryUserNotificationState for exclusive fullscreen or presentation mode
        let mut quns = 0i32;
        if SHQueryUserNotificationState(&mut quns) == 0 {
            // 3: QUNS_RUNNING_D3D_FULL_SCREEN, 4: QUNS_PRESENTATION_MODE
            if quns == 3 || quns == 4 {
                return "hidden";
            }
        }

        // 2. Check foreground window
        let hwnd = GetForegroundWindow();
        if hwnd == 0 || IsWindowVisible(hwnd) == 0 {
            return "desktop";
        }

        // 3. Ignore our own process window to avoid mode bouncing
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == GetCurrentProcessId() {
            return ""; // No change
        }

        // 4. Check if desktop or taskbar
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(hwnd, class_name.as_mut_ptr(), 256) as usize;
        if len > 0 {
            let class_str = String::from_utf16_lossy(&class_name[..len]);
            if class_str == "Progman"
                || class_str == "WorkerW"
                || class_str == "Shell_TrayWnd"
                || class_str == "Shell_SecondaryTrayWnd"
            {
                return "desktop";
            }
        }

        // 5. Check if window is maximized (IsZoomed)
        if IsZoomed(hwnd) != 0 {
            return "app";
        }

        // 6. Check if window covers entire monitor (borderless fullscreen / video fullscreen)
        let h_mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if h_mon != 0 {
            let mut mi = MONITORINFO {
                cb_size: std::mem::size_of::<MONITORINFO>() as u32,
                rc_monitor: RECT::default(),
                rc_work: RECT::default(),
                dw_flags: 0,
            };
            if GetMonitorInfoW(h_mon, &mut mi) != 0 {
                let mut rect = RECT::default();
                if GetWindowRect(hwnd, &mut rect) != 0 {
                    if rect.left <= mi.rc_monitor.left
                        && rect.top <= mi.rc_monitor.top
                        && rect.right >= mi.rc_monitor.right
                        && rect.bottom >= mi.rc_monitor.bottom
                    {
                        return "app";
                    }
                }
            }
        }

        // Normal unmaximized floating window
        "desktop"
    }
    #[cfg(not(windows))]
    {
        "desktop"
    }
}

pub fn check_and_emit_foreground_state() {
    let mode = query_foreground_mode();
    if mode.is_empty() {
        return;
    }

    let mode_id = match mode {
        "desktop" => 1,
        "app" => 2,
        "hidden" => 3,
        _ => 1,
    };

    if LAST_MODE.swap(mode_id, Ordering::Relaxed) != mode_id {
        if let Some(app) = APP_HANDLE.get() {
            let _ = app.emit(
                "app_mode_changed",
                AppModePayload {
                    mode: mode.to_string(),
                },
            );

            if let Some(window) = app.get_webview_window("main") {
                if mode == "hidden" {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                }
            }
        }
    }
}

#[cfg(windows)]
unsafe extern "system" fn win_event_proc(
    _h_win_event_hook: isize,
    _event: u32,
    _hwnd: isize,
    _id_object: i32,
    _id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    check_and_emit_foreground_state();
}

pub fn start_detector(app: AppHandle) {
    let _ = APP_HANDLE.set(app);

    // Initial check on launch
    check_and_emit_foreground_state();

    #[cfg(windows)]
    thread::spawn(|| unsafe {
        let hook_fg = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            0,
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );

        let hook_move = SetWinEventHook(
            EVENT_SYSTEM_MOVESIZEEND,
            EVENT_SYSTEM_MOVESIZEEND,
            0,
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );

        let mut msg = MSG {
            hwnd: 0,
            message: 0,
            wparam: 0,
            lparam: 0,
            time: 0,
            pt: POINT { x: 0, y: 0 },
        };

        while GetMessageW(&mut msg, 0, 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        if hook_fg != 0 {
            UnhookWinEvent(hook_fg);
        }
        if hook_move != 0 {
            UnhookWinEvent(hook_move);
        }
    });
}

#[tauri::command]
pub fn get_app_mode() -> String {
    let mode = query_foreground_mode();
    if mode.is_empty() {
        "desktop".to_string()
    } else {
        mode.to_string()
    }
}
