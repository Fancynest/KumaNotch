use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::DataReader;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    pub is_active: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playback_status: String, // "playing", "paused", "stopped"
    pub position_ms: u64,
    pub duration_ms: u64,
    pub app_id: String,
    pub thumbnail_base64: Option<String>,
}

impl Default for MediaState {
    fn default() -> Self {
        Self {
            is_active: false,
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            playback_status: "stopped".to_string(),
            position_ms: 0,
            duration_ms: 0,
            app_id: String::new(),
            thumbnail_base64: None,
        }
    }
}

pub struct MediaManager {
    #[allow(dead_code)]
    app_handle: AppHandle,
    session_manager: Option<GlobalSystemMediaTransportControlsSessionManager>,
    current_state: Arc<Mutex<MediaState>>,
    #[allow(dead_code)]
    last_thumbnail_key: Arc<Mutex<String>>,
    #[allow(dead_code)]
    cached_thumbnail: Arc<Mutex<Option<String>>>,
}

static MEDIA_MANAGER: OnceLock<Arc<Mutex<Option<MediaManager>>>> = OnceLock::new();

pub fn init_media(app_handle: AppHandle) {
    let current_state = Arc::new(Mutex::new(MediaState::default()));
    let last_thumbnail_key = Arc::new(Mutex::new(String::new()));
    let cached_thumbnail = Arc::new(Mutex::new(None));

    let mgr_holder = Arc::new(Mutex::new(None));
    let _ = MEDIA_MANAGER.set(mgr_holder.clone());

    let app_handle_clone = app_handle.clone();
    let current_state_clone = current_state.clone();
    let last_thumb_clone = last_thumbnail_key.clone();
    let cached_thumb_clone = cached_thumbnail.clone();

    // Spawn a dedicated thread for COM / WinRT SMTC session management
    thread::spawn(move || {
        // Request session manager
        let session_manager_res = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .and_then(|op| op.join());

        let session_manager = match session_manager_res {
            Ok(sm) => sm,
            Err(e) => {
                log::error!("Failed to obtain SMTC SessionManager: {:?}", e);
                return;
            }
        };

        let media_mgr = MediaManager {
            app_handle: app_handle_clone.clone(),
            session_manager: Some(session_manager.clone()),
            current_state: current_state_clone.clone(),
            last_thumbnail_key: last_thumb_clone.clone(),
            cached_thumbnail: cached_thumb_clone.clone(),
        };

        {
            let mut lock = mgr_holder.lock().unwrap();
            *lock = Some(media_mgr);
        }

        // Initial refresh
        refresh_sessions(&session_manager, &app_handle_clone, &current_state_clone, &last_thumb_clone, &cached_thumb_clone);

        // Subscribe to SessionsChanged and CurrentSessionChanged events
        let sm_for_sessions = session_manager.clone();
        let app_handle_s = app_handle_clone.clone();
        let state_s = current_state_clone.clone();
        let thumb_key_s = last_thumb_clone.clone();
        let cached_thumb_s = cached_thumb_clone.clone();

        let _ = session_manager.SessionsChanged(&TypedEventHandler::new(
            move |_, _| {
                refresh_sessions(&sm_for_sessions, &app_handle_s, &state_s, &thumb_key_s, &cached_thumb_s);
                bind_session_listeners(&sm_for_sessions, &app_handle_s, &state_s, &thumb_key_s, &cached_thumb_s);
                Ok(())
            },
        ));

        let sm_for_current = session_manager.clone();
        let app_handle_c = app_handle_clone.clone();
        let state_c = current_state_clone.clone();
        let thumb_key_c = last_thumb_clone.clone();
        let cached_thumb_c = cached_thumb_clone.clone();

        let _ = session_manager.CurrentSessionChanged(&TypedEventHandler::new(
            move |_, _| {
                refresh_sessions(&sm_for_current, &app_handle_c, &state_c, &thumb_key_c, &cached_thumb_c);
                Ok(())
            },
        ));

        // Setup session event listeners
        bind_session_listeners(&session_manager, &app_handle_clone, &current_state_clone, &last_thumb_clone, &cached_thumb_clone);
    });
}

fn select_best_session(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    // 1. Check all sessions, prioritize any currently playing session
    if let Ok(sessions) = manager.GetSessions() {
        let count = sessions.Size().unwrap_or(0);
        let mut best_paused = None;
        for i in 0..count {
            if let Ok(session) = sessions.GetAt(i) {
                if let Ok(info) = session.GetPlaybackInfo() {
                    if let Ok(status) = info.PlaybackStatus() {
                        if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
                            return Some(session);
                        } else if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused {
                            if best_paused.is_none() {
                                best_paused = Some(session);
                            }
                        }
                    }
                }
            }
        }
        if best_paused.is_some() {
            return best_paused;
        }
    }

    // 2. Fall back to current session
    manager.GetCurrentSession().ok()
}

fn bind_session_listeners(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    app_handle: &AppHandle,
    state: &Arc<Mutex<MediaState>>,
    thumb_key: &Arc<Mutex<String>>,
    cached_thumb: &Arc<Mutex<Option<String>>>,
) {
    if let Ok(sessions) = manager.GetSessions() {
        let count = sessions.Size().unwrap_or(0);
        for i in 0..count {
            if let Ok(session) = sessions.GetAt(i) {
                let mgr_clone1 = manager.clone();
                let app1 = app_handle.clone();
                let st1 = state.clone();
                let tk1 = thumb_key.clone();
                let ct1 = cached_thumb.clone();
                let _ = session.MediaPropertiesChanged(&TypedEventHandler::new(
                    move |_, _| {
                        refresh_sessions(&mgr_clone1, &app1, &st1, &tk1, &ct1);
                        Ok(())
                    },
                ));

                let mgr_clone2 = manager.clone();
                let app2 = app_handle.clone();
                let st2 = state.clone();
                let tk2 = thumb_key.clone();
                let ct2 = cached_thumb.clone();
                let _ = session.PlaybackInfoChanged(&TypedEventHandler::new(
                    move |_, _| {
                        refresh_sessions(&mgr_clone2, &app2, &st2, &tk2, &ct2);
                        Ok(())
                    },
                ));

                let mgr_clone3 = manager.clone();
                let app3 = app_handle.clone();
                let st3 = state.clone();
                let tk3 = thumb_key.clone();
                let ct3 = cached_thumb.clone();
                let _ = session.TimelinePropertiesChanged(&TypedEventHandler::new(
                    move |_, _| {
                        refresh_sessions(&mgr_clone3, &app3, &st3, &tk3, &ct3);
                        Ok(())
                    },
                ));
            }
        }
    }
}

fn refresh_sessions(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    app_handle: &AppHandle,
    state: &Arc<Mutex<MediaState>>,
    thumb_key: &Arc<Mutex<String>>,
    cached_thumb: &Arc<Mutex<Option<String>>>,
) {
    let session_opt = select_best_session(manager);

    let new_state = match session_opt {
        Some(session) => {
            let app_id = session
                .SourceAppUserModelId()
                .map(|s| s.to_string())
                .unwrap_or_default();

            let playback_status = if let Ok(info) = session.GetPlaybackInfo() {
                match info.PlaybackStatus() {
                    Ok(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing) => "playing",
                    Ok(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused) => "paused",
                    Ok(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped) => "stopped",
                    _ => "stopped",
                }
            } else {
                "stopped"
            };

            let mut title = String::new();
            let mut artist = String::new();
            let mut album = String::new();
            let mut thumbnail_b64 = None;

            if let Ok(media_props_op) = session.TryGetMediaPropertiesAsync() {
                if let Ok(props) = media_props_op.join() {
                    title = props.Title().map(|s| s.to_string()).unwrap_or_default();
                    artist = props.Artist().map(|s| s.to_string()).unwrap_or_default();
                    album = props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();

                    let track_key = format!("{}::{}_{}", app_id, title, artist);
                    let mut key_lock = thumb_key.lock().unwrap();
                    let mut cache_lock = cached_thumb.lock().unwrap();

                    if *key_lock == track_key && cache_lock.is_some() {
                        thumbnail_b64 = cache_lock.clone();
                    } else if !title.is_empty() {
                        if let Ok(thumb_ref) = props.Thumbnail() {
                            if let Ok(stream_op) = thumb_ref.OpenReadAsync() {
                                if let Ok(stream) = stream_op.join() {
                                    if let Ok(size) = stream.Size() {
                                        if size > 0 && size < 5 * 1024 * 1024 {
                                            if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                                if reader.LoadAsync(size as u32).and_then(|op| op.join()).is_ok() {
                                                    let mut buf = vec![0u8; size as usize];
                                                    if reader.ReadBytes(&mut buf).is_ok() {
                                                        let encoded = format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(&buf));
                                                        *key_lock = track_key;
                                                        *cache_lock = Some(encoded.clone());
                                                        thumbnail_b64 = Some(encoded);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let mut position_ms = 0u64;
            let mut duration_ms = 0u64;

            if let Ok(timeline) = session.GetTimelineProperties() {
                if let Ok(pos) = timeline.Position() {
                    // TimeSpan Duration is in 100-nanosecond units (1 ms = 10,000 units)
                    position_ms = (pos.Duration / 10_000).max(0) as u64;
                }
                if let Ok(end) = timeline.EndTime() {
                    duration_ms = (end.Duration / 10_000).max(0) as u64;
                }
            }

            let is_active = !title.is_empty() && (playback_status == "playing" || playback_status == "paused");

            MediaState {
                is_active,
                title,
                artist,
                album,
                playback_status: playback_status.to_string(),
                position_ms,
                duration_ms,
                app_id,
                thumbnail_base64: thumbnail_b64,
            }
        }
        None => MediaState::default(),
    };

    let mut state_lock = state.lock().unwrap();
    if *state_lock != new_state {
        *state_lock = new_state.clone();
        let _ = app_handle.emit("media_state_changed", &new_state);
    }
}

// Commands exposed to Tauri frontend

#[tauri::command]
pub fn media_get_state() -> MediaState {
    if let Some(holder) = MEDIA_MANAGER.get() {
        if let Ok(lock) = holder.lock() {
            if let Some(ref mgr) = *lock {
                if let Ok(st) = mgr.current_state.lock() {
                    return st.clone();
                }
            }
        }
    }
    MediaState::default()
}

#[tauri::command]
pub fn media_play() -> bool {
    with_session(|session| {
        session.TryPlayAsync().and_then(|op| op.join()).unwrap_or(false)
    }).unwrap_or(false)
}

#[tauri::command]
pub fn media_pause() -> bool {
    with_session(|session| {
        session.TryPauseAsync().and_then(|op| op.join()).unwrap_or(false)
    }).unwrap_or(false)
}

#[tauri::command]
pub fn media_toggle_play_pause() -> bool {
    with_session(|session| {
        session.TryTogglePlayPauseAsync().and_then(|op| op.join()).unwrap_or(false)
    }).unwrap_or(false)
}

#[tauri::command]
pub fn media_next() -> bool {
    with_session(|session| {
        session.TrySkipNextAsync().and_then(|op| op.join()).unwrap_or(false)
    }).unwrap_or(false)
}

#[tauri::command]
pub fn media_prev() -> bool {
    with_session(|session| {
        session.TrySkipPreviousAsync().and_then(|op| op.join()).unwrap_or(false)
    }).unwrap_or(false)
}

#[tauri::command]
pub fn media_seek(position_ms: u64) -> bool {
    with_session(|session| {
        // Convert ms to 100-nanosecond units
        let units = (position_ms as i64) * 10_000;
        session.TryChangePlaybackPositionAsync(units).and_then(|op| op.join()).unwrap_or(false)
    }).unwrap_or(false)
}

fn with_session<F, R>(f: F) -> Option<R>
where
    F: FnOnce(&GlobalSystemMediaTransportControlsSession) -> R,
{
    if let Some(holder) = MEDIA_MANAGER.get() {
        if let Ok(lock) = holder.lock() {
            if let Some(ref mgr) = *lock {
                if let Some(ref sm) = mgr.session_manager {
                    if let Some(session) = select_best_session(sm) {
                        return Some(f(&session));
                    }
                }
            }
        }
    }
    None
}
