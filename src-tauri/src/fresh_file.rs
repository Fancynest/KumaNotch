use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[repr(C)]
#[derive(Clone, Copy)]
pub struct GUID {
    pub data1: u32,
    pub data2: u16,
    pub data3: u16,
    pub data4: [u8; 8],
}

const FOLDERID_DOWNLOADS: GUID = GUID {
    data1: 0x374DE290,
    data2: 0x123F,
    data3: 0x4565,
    data4: [0x91, 0x64, 0x39, 0xC4, 0x92, 0x5E, 0x46, 0x7B],
};

const FOLDERID_SCREENSHOTS: GUID = GUID {
    data1: 0xB7BEDE81,
    data2: 0xDF94,
    data3: 0x4782,
    data4: [0xAC, 0x5D, 0x95, 0x25, 0x2C, 0x17, 0xF7, 0x5A],
};

const FOLDERID_PICTURES: GUID = GUID {
    data1: 0x33E28130,
    data2: 0x4E1E,
    data3: 0x4676,
    data4: [0x83, 0x5A, 0x98, 0x39, 0x5C, 0x3B, 0xC3, 0xBB],
};

#[cfg(windows)]
unsafe extern "system" {
    fn SHGetKnownFolderPath(
        rfid: *const GUID,
        dwflags: u32,
        htoken: isize,
        ppszpath: *mut *mut u16,
    ) -> i32;
    fn CoTaskMemFree(pv: *mut std::ffi::c_void);
}

pub fn get_known_folder_path(guid: &GUID) -> Option<PathBuf> {
    #[cfg(windows)]
    unsafe {
        let mut path_ptr: *mut u16 = std::ptr::null_mut();
        if SHGetKnownFolderPath(guid, 0, 0, &mut path_ptr) == 0 && !path_ptr.is_null() {
            let mut len = 0;
            while *path_ptr.add(len) != 0 {
                len += 1;
            }
            let slice = std::slice::from_raw_parts(path_ptr, len);
            let path_str = String::from_utf16_lossy(slice);
            CoTaskMemFree(path_ptr as *mut std::ffi::c_void);
            let p = PathBuf::from(path_str);
            if p.exists() {
                return Some(p);
            }
        }
        None
    }
    #[cfg(not(windows))]
    {
        let _ = guid;
        None
    }
}

pub fn get_downloads_folder() -> Option<PathBuf> {
    get_known_folder_path(&FOLDERID_DOWNLOADS).or_else(|| {
        std::env::var_os("USERPROFILE").map(|u| PathBuf::from(u).join("Downloads"))
    })
}

pub fn get_screenshots_folder() -> Option<PathBuf> {
    if let Some(p) = get_known_folder_path(&FOLDERID_SCREENSHOTS) {
        if p.exists() {
            return Some(p);
        }
    }
    if let Some(pictures) = get_known_folder_path(&FOLDERID_PICTURES) {
        let sc = pictures.join("Screenshots");
        if sc.exists() {
            return Some(sc);
        }
        let sc_id = pictures.join("Tangkapan Layar");
        if sc_id.exists() {
            return Some(sc_id);
        }
    }
    if let Some(user) = std::env::var_os("USERPROFILE") {
        let sc = PathBuf::from(&user).join("Pictures").join("Screenshots");
        if sc.exists() {
            return Some(sc);
        }
        let sc_id = PathBuf::from(&user).join("Pictures").join("Tangkapan Layar");
        if sc_id.exists() {
            return Some(sc_id);
        }
    }
    if let Some(onedrive) = std::env::var_os("OneDrive") {
        let sc = PathBuf::from(&onedrive).join("Pictures").join("Screenshots");
        if sc.exists() {
            return Some(sc);
        }
    }
    std::env::var_os("USERPROFILE")
        .map(|u| PathBuf::from(u).join("Pictures").join("Screenshots"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreshFileInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
    pub thumbnail: Option<String>,
    pub is_batch: bool,
    pub batch_count: usize,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreshFileSources {
    pub screenshots: bool,
    pub downloads: bool,
    pub custom_folders: Vec<String>,
}

impl Default for FreshFileSources {
    fn default() -> Self {
        Self {
            screenshots: true,
            downloads: true,
            custom_folders: Vec::new(),
        }
    }
}

struct FreshFileState {
    sources: FreshFileSources,
    recent_files: Vec<FreshFileInfo>,
    thumbnail_cache: HashMap<String, String>,
    initial_baseline: HashSet<PathBuf>,
    recent_arrivals: Vec<(Instant, PathBuf)>,
    processing_paths: HashSet<PathBuf>,
}

static FRESH_STATE: std::sync::OnceLock<Mutex<FreshFileState>> = std::sync::OnceLock::new();

fn get_state() -> &'static Mutex<FreshFileState> {
    FRESH_STATE.get_or_init(|| {
        Mutex::new(FreshFileState {
            sources: FreshFileSources::default(),
            recent_files: Vec::new(),
            thumbnail_cache: HashMap::new(),
            initial_baseline: HashSet::new(),
            recent_arrivals: Vec::new(),
            processing_paths: HashSet::new(),
        })
    })
}

// Generate thumbnail for file (supports PNG, JPG, WEBP, and shell fallback)
pub fn generate_file_thumbnail(path: &Path) -> Option<String> {
    // Check in-memory cache first
    let path_str = path.to_string_lossy().to_string();
    {
        let state = get_state().lock().unwrap();
        if let Some(cached) = state.thumbnail_cache.get(&path_str) {
            return Some(cached.clone());
        }
    }

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Fast in-process thumbnail for standard image formats
    if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "bmp") {
        if let Ok(img) = image::open(path) {
            let thumb = img.thumbnail(256, 256);
            let mut buf = std::io::Cursor::new(Vec::new());
            if thumb.write_to(&mut buf, image::ImageFormat::Png).is_ok() {
                use base64::Engine;
                let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
                let data_url = format!("data:image/png;base64,{}", b64);
                let mut state = get_state().lock().unwrap();
                state
                    .thumbnail_cache
                    .insert(path_str.clone(), data_url.clone());
                return Some(data_url);
            }
        }
    }

    #[cfg(windows)]
    {
        if let Some(data_url) = generate_shell_thumbnail_win32(path) {
            let mut state = get_state().lock().unwrap();
            state
                .thumbnail_cache
                .insert(path_str.clone(), data_url.clone());
            return Some(data_url);
        }
    }

    None
}

#[cfg(windows)]
fn generate_shell_thumbnail_win32(path: &Path) -> Option<String> {
    #[repr(C)]
    struct SIZE {
        cx: i32,
        cy: i32,
    }

    const IID_ISHELL_ITEM_IMAGE_FACTORY: GUID = GUID {
        data1: 0xBCC18B79,
        data2: 0xBA16,
        data3: 0x442F,
        data4: [0x80, 0xC4, 0x8A, 0x59, 0xC0, 0x7C, 0x59, 0x30],
    };

    #[repr(C)]
    struct IShellItemImageFactoryVtbl {
        query_interface: unsafe extern "system" fn(
            *mut std::ffi::c_void,
            *const GUID,
            *mut *mut std::ffi::c_void,
        ) -> i32,
        add_ref: unsafe extern "system" fn(*mut std::ffi::c_void) -> u32,
        release: unsafe extern "system" fn(*mut std::ffi::c_void) -> u32,
        get_image: unsafe extern "system" fn(
            *mut std::ffi::c_void,
            SIZE,
            u32,
            *mut isize,
        ) -> i32,
    }

    #[repr(C)]
    struct BITMAP {
        bm_type: i32,
        bm_width: i32,
        bm_height: i32,
        bm_width_bytes: i32,
        bm_planes: u16,
        bm_bits_pixel: u16,
        bm_bits: *mut std::ffi::c_void,
    }

    #[repr(C)]
    struct BITMAPINFOHEADER {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    unsafe extern "system" {
        fn CoInitializeEx(pv_reserved: *mut std::ffi::c_void, dw_co_init: u32) -> i32;
        fn CoUninitialize();
        fn SHCreateItemFromParsingName(
            pszpath: *const u16,
            pbc: *mut std::ffi::c_void,
            riid: *const GUID,
            ppv: *mut *mut std::ffi::c_void,
        ) -> i32;
        fn GetObjectW(h: isize, c: i32, pv: *mut std::ffi::c_void) -> i32;
        fn DeleteObject(ho: isize) -> i32;
        fn GetDC(hwnd: isize) -> isize;
        fn ReleaseDC(hwnd: isize, hdc: isize) -> i32;
        fn GetDIBits(
            hdc: isize,
            hbm: isize,
            start: u32,
            lines: u32,
            lpvbits: *mut std::ffi::c_void,
            lpbmi: *mut BITMAPINFOHEADER,
            usage: u32,
        ) -> i32;
    }

    unsafe {
        let co_res = CoInitializeEx(std::ptr::null_mut(), 0);
        let wide_path: Vec<u16> = path
            .to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let mut factory_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
        if SHCreateItemFromParsingName(
            wide_path.as_ptr(),
            std::ptr::null_mut(),
            &IID_ISHELL_ITEM_IMAGE_FACTORY,
            &mut factory_ptr,
        ) != 0
            || factory_ptr.is_null()
        {
            if co_res == 0 || co_res == 1 {
                CoUninitialize();
            }
            return None;
        }

        let vtbl = *(factory_ptr as *mut *mut IShellItemImageFactoryVtbl);
        let mut hbitmap: isize = 0;
        let hr = ((*vtbl).get_image)(
            factory_ptr,
            SIZE { cx: 256, cy: 256 },
            0, // SIIGBF_RESIZETOFIT
            &mut hbitmap,
        );
        ((*vtbl).release)(factory_ptr);

        if hr != 0 || hbitmap == 0 {
            return None;
        }

        let mut bm: BITMAP = std::mem::zeroed();
        if GetObjectW(
            hbitmap,
            std::mem::size_of::<BITMAP>() as i32,
            &mut bm as *mut _ as *mut _,
        ) == 0
        {
            DeleteObject(hbitmap);
            return None;
        }

        let width = bm.bm_width;
        let height = bm.bm_height;
        if width <= 0 || height <= 0 {
            DeleteObject(hbitmap);
            return None;
        }

        let mut bmi_header = BITMAPINFOHEADER {
            bi_size: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            bi_width: width,
            bi_height: -height, // top-down
            bi_planes: 1,
            bi_bit_count: 32,
            bi_compression: 0, // BI_RGB
            bi_size_image: 0,
            bi_x_pels_per_meter: 0,
            bi_y_pels_per_meter: 0,
            bi_clr_used: 0,
            bi_clr_important: 0,
        };

        let hdc = GetDC(0);
        let mut raw_pixels = vec![0u8; (width * height * 4) as usize];
        let lines_copied = GetDIBits(
            hdc,
            hbitmap,
            0,
            height as u32,
            raw_pixels.as_mut_ptr() as *mut _,
            &mut bmi_header,
            0, // DIB_RGB_COLORS
        );
        ReleaseDC(0, hdc);
        DeleteObject(hbitmap);

        if lines_copied == 0 {
            return None;
        }

        // Convert BGRA to RGBA
        for chunk in raw_pixels.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
            // If alpha is 0, give full opacity
            if chunk[3] == 0 {
                chunk[3] = 255;
            }
        }

        if let Some(rgba) =
            image::RgbaImage::from_raw(width as u32, height as u32, raw_pixels)
        {
            let mut buf = std::io::Cursor::new(Vec::new());
            if rgba.write_to(&mut buf, image::ImageFormat::Png).is_ok() {
                use base64::Engine;
                let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
                return Some(format!("data:image/png;base64,{}", b64));
            }
        }

        None
    }
}

// Scans initial files so existing files before app startup are ignored
fn scan_baseline_files(folder: &Path, baseline: &mut HashSet<PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(folder) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    baseline.insert(entry.path());
                }
            }
        }
    }
}

// Checks if a path is considered a temporary / incomplete download file
fn is_temporary_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if name.starts_with('.') || name.starts_with("~$") {
        return true;
    }

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    matches!(
        ext.as_str(),
        "crdownload"
            | "part"
            | "tmp"
            | "download"
            | "opdownload"
            | "partial"
            | "temp"
    )
}

struct ProcessingGuard(PathBuf);
impl Drop for ProcessingGuard {
    fn drop(&mut self) {
        let mut state = get_state().lock().unwrap();
        state.processing_paths.remove(&self.0);
    }
}

// Spawns readiness checker: waits until size is stable for 800ms and file can be read
fn process_candidate_file(app: AppHandle, path: PathBuf) {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = ProcessingGuard(path.clone());
        let start = Instant::now();
        let mut last_size: Option<u64> = None;
        let mut stable_since: Option<Instant> = None;

        while start.elapsed() < Duration::from_secs(30) {
            std::thread::sleep(Duration::from_millis(300));

            if !path.exists() {
                return;
            }

            if is_temporary_file(&path) {
                return;
            }

            if let Ok(meta) = std::fs::metadata(&path) {
                let cur_size = meta.len();
                if cur_size > 0 {
                    if let Some(prev) = last_size {
                        if prev == cur_size {
                            if stable_since.is_none() {
                                stable_since = Some(Instant::now());
                            } else if stable_since.unwrap().elapsed()
                                >= Duration::from_millis(800)
                            {
                                // Test if file can be opened for reading (not locked by downloader)
                                if std::fs::File::open(&path).is_ok() {
                                    handle_file_ready(app, path);
                                    return;
                                }
                            }
                        } else {
                            last_size = Some(cur_size);
                            stable_since = None;
                        }
                    } else {
                        last_size = Some(cur_size);
                    }
                }
            }
        }
    });
}

fn handle_file_ready(app: AppHandle, path: PathBuf) {
    let now = Instant::now();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let mut state = get_state().lock().unwrap();

    // Debounce: Clean old arrivals older than 2 seconds
    state
        .recent_arrivals
        .retain(|(t, _)| now.duration_since(*t) <= Duration::from_secs(2));

    if !state.recent_arrivals.iter().any(|(_, p)| p == &path) {
        state.recent_arrivals.push((now, path.clone()));
    }

    let mut distinct_paths = HashSet::new();
    for (_, p) in &state.recent_arrivals {
        distinct_paths.insert(p.clone());
    }
    let recent_count = distinct_paths.len();
    let is_batch = recent_count > 4;
    let batch_count = recent_count;

    let id = format!(
        "fresh_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        recent_count
    );

    let display_name = if is_batch {
        format!("{} file baru", batch_count)
    } else {
        file_name
    };

    let thumbnail = generate_file_thumbnail(&path);

    let fresh_info = FreshFileInfo {
        id: id.clone(),
        path: path.to_string_lossy().to_string(),
        name: display_name,
        size,
        extension,
        thumbnail,
        is_batch,
        batch_count,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    // Keep up to 5 recent files for the shelf "Baru" strip
    state.recent_files.retain(|f| f.path != fresh_info.path);
    state.recent_files.insert(0, fresh_info.clone());
    if state.recent_files.len() > 5 {
        state.recent_files.truncate(5);
    }

    // Emit event to frontend
    let _ = app.emit("fresh_file://discovered", &fresh_info);
}

// Initializes the Fresh File Tray watcher
pub fn init_fresh_file_watcher(app: AppHandle) {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut folders_to_watch: Vec<PathBuf> = Vec::new();

        if let Some(dl) = get_downloads_folder() {
            if !folders_to_watch.contains(&dl) {
                folders_to_watch.push(dl);
            }
        }
        if let Some(sc) = get_screenshots_folder() {
            if !folders_to_watch.contains(&sc) {
                folders_to_watch.push(sc);
            }
        }
        if let Some(user) = std::env::var_os("USERPROFILE") {
            let direct_sc = PathBuf::from(&user).join("Pictures").join("Screenshots");
            if direct_sc.exists() && !folders_to_watch.contains(&direct_sc) {
                folders_to_watch.push(direct_sc);
            }
        }
        if let Some(onedrive) = std::env::var_os("OneDrive") {
            let od_sc = PathBuf::from(&onedrive).join("Pictures").join("Screenshots");
            if od_sc.exists() && !folders_to_watch.contains(&od_sc) {
                folders_to_watch.push(od_sc);
            }
        }

        // Establish initial baseline
        {
            let mut state = get_state().lock().unwrap();
            for folder in &folders_to_watch {
                scan_baseline_files(folder, &mut state.initial_baseline);
            }
        }

        use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[fresh_file] failed to initialize notify watcher: {:?}", e);
                return;
            }
        };

        for folder in &folders_to_watch {
            if folder.exists() {
                if let Err(e) = watcher.watch(folder, RecursiveMode::NonRecursive) {
                    eprintln!("[fresh_file] error watching folder {:?}: {:?}", folder, e);
                } else {
                    println!("[fresh_file] actively watching folder: {:?}", folder);
                }
            }
        }

        while let Ok(res) = rx.recv() {
            match res {
                Ok(Event { kind, paths, .. }) => {
                    let is_relevant = match kind {
                        EventKind::Create(_) => true,
                        EventKind::Modify(_) => true,
                        EventKind::Any => true,
                        _ => false,
                    };

                    if is_relevant {
                        for path in paths {
                            if is_temporary_file(&path) {
                                continue;
                            }

                            // Check if file existed before app startup
                            let is_pre_existing = {
                                let state = get_state().lock().unwrap();
                                state.initial_baseline.contains(&path)
                            };

                            if is_pre_existing {
                                continue;
                            }

                            let is_already_processing = {
                                let mut state = get_state().lock().unwrap();
                                if state.processing_paths.contains(&path) {
                                    true
                                } else {
                                    state.processing_paths.insert(path.clone());
                                    false
                                }
                            };

                            if !is_already_processing {
                                process_candidate_file(app_clone.clone(), path);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[fresh_file] notify watcher event error: {:?}", e);
                }
            }
        }
    });
}

// Tauri commands
#[tauri::command]
pub fn fresh_get_recent_files() -> Vec<FreshFileInfo> {
    let state = get_state().lock().unwrap();
    state.recent_files.clone()
}

#[tauri::command]
pub fn fresh_get_thumbnail(path: String) -> Result<String, String> {
    let p = PathBuf::from(path.trim().trim_matches('"'));
    if let Some(thumb) = generate_file_thumbnail(&p) {
        Ok(thumb)
    } else {
        Err("Thumbnail not available".to_string())
    }
}

#[tauri::command]
pub fn fresh_dismiss(id: String) -> Result<(), String> {
    let mut state = get_state().lock().unwrap();
    state.recent_files.retain(|f| f.id != id);
    Ok(())
}

#[tauri::command]
pub fn fresh_get_sources() -> FreshFileSources {
    let state = get_state().lock().unwrap();
    state.sources.clone()
}

#[tauri::command]
pub fn fresh_set_sources(sources: FreshFileSources) -> Result<(), String> {
    let mut state = get_state().lock().unwrap();
    state.sources = sources;
    Ok(())
}
