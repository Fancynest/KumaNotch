mod detector;
mod media;
mod shelf;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            window::resize_island,
            window::get_system_time_format,
            detector::get_app_mode,
            shelf::shelf_get_metadata,
            shelf::shelf_check_exists,
            shelf::shelf_open_path,
            shelf::shelf_show_in_folder,
            shelf::shelf_copy_path,
            shelf::shelf_start_drag,
            media::media_get_state,
            media::media_play,
            media::media_pause,
            media::media_toggle_play_pause,
            media::media_next,
            media::media_prev,
            media::media_seek,
        ])
        .setup(|app| {
            let handle = app.handle();
            let _ = window::setup_window(handle);
            let _ = tray::create_tray(handle);
            detector::start_detector(handle.clone());
            media::init_media(handle.clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building kumanotch application");
}
