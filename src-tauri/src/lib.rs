mod audio_device;
mod detector;
mod fresh_file;
mod media;
pub mod process_watcher;
mod shelf;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".into());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            *s
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.as_str()
        } else {
            "Box<Any>"
        };
        log::error!("CRITICAL: Thread panic at {}: {}", location, payload);
        eprintln!("CRITICAL: Thread panic at {}: {}", location, payload);
    }));

    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log_level)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
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
            window::set_hit_region,
            window::set_island_offset,
            window::get_island_offset,
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
            tray::autostart_is_enabled,
            tray::autostart_set,
            tray::tray_set_personality,
            fresh_file::fresh_get_recent_files,
            fresh_file::fresh_get_thumbnail,
            fresh_file::fresh_dismiss,
            fresh_file::fresh_get_sources,
            fresh_file::fresh_set_sources,
            process_watcher::power_action,
            process_watcher::get_running_processes,
            process_watcher::watch_process,
            process_watcher::is_kuma_in_path,
            process_watcher::add_kuma_to_path,
        ])
        .setup(|app| {
            let handle = app.handle();
            let _ = window::setup_window(handle);
            let _ = tray::create_tray(handle);
            detector::start_detector(handle.clone());
            media::init_media(handle.clone());
            fresh_file::init_fresh_file_watcher(handle.clone());
            audio_device::start_audio_device_watcher(handle.clone());
            process_watcher::start_process_watcher(handle.clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building kumanotch application");
}
