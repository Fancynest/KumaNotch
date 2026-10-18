mod tray;
mod window;

use std::fs::OpenOptions;
use std::io::Write;
use tauri::Manager;

fn log(msg: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open("C:\\Users\\Gabriel\\tauri_debug.log")
    {
        let _ = writeln!(file, "[{}] {}", chrono_or_now(), msg);
    }
}

fn chrono_or_now() -> &'static str {
    "LOG"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log("run() entered");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            log("single_instance callback");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![window::resize_island])
        .setup(|app| {
            log("setup() hook entered");
            let handle = app.handle();
            let _ = window::setup_window(handle);
            let _ = tray::create_tray(handle);
            log("setup() completed");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building kumanotch application");
    log("run() finished");
}
