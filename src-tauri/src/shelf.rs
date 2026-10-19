use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct ShelfMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub exists: bool,
    pub extension: String,
}

#[tauri::command]
pub fn shelf_get_metadata(paths: Vec<String>) -> Vec<ShelfMetadata> {
    let mut results = Vec::new();
    for p_str in paths {
        let clean_str = p_str.trim().trim_matches('"');
        let p = Path::new(clean_str);
        let exists = p.exists();
        let is_dir = p.is_dir();
        let name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| {
                clean_str
                    .trim_end_matches(['/', '\\'])
                    .split(['/', '\\'])
                    .last()
                    .filter(|s| !s.is_empty())
                    .unwrap_or(clean_str)
                    .to_string()
            });
        let size = if is_dir {
            0
        } else {
            std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)
        };
        let extension = if is_dir {
            String::new()
        } else {
            p.extension()
                .map(|e| e.to_string_lossy().to_string().to_lowercase())
                .unwrap_or_default()
        };

        results.push(ShelfMetadata {
            path: clean_str.to_string(),
            name,
            size,
            is_dir,
            exists,
            extension,
        });
    }
    results
}

#[tauri::command]
pub fn shelf_check_exists(paths: Vec<String>) -> HashMap<String, bool> {
    let mut map = HashMap::new();
    for p_str in paths {
        let clean_str = p_str.trim().trim_matches('"');
        let exists = Path::new(clean_str).exists();
        map.insert(p_str, exists);
    }
    map
}

#[cfg(windows)]
unsafe extern "system" {
    fn ShellExecuteW(
        hwnd: isize,
        lpoperation: *const u16,
        lpfile: *const u16,
        lpparameters: *const u16,
        lpdirectory: *const u16,
        nshowcmd: i32,
    ) -> isize;

    fn OpenClipboard(hwnd: isize) -> i32;
    fn CloseClipboard() -> i32;
    fn EmptyClipboard() -> i32;
    fn SetClipboardData(uformat: u32, hmem: isize) -> isize;
    fn GlobalAlloc(uflags: u32, dwbytes: usize) -> isize;
    fn GlobalLock(hmem: isize) -> *mut std::ffi::c_void;
    fn GlobalUnlock(hmem: isize) -> i32;
}

#[cfg(windows)]
const CF_UNICODETEXT: u32 = 13;
#[cfg(windows)]
const GMEM_MOVEABLE: u32 = 0x0002;

#[tauri::command]
pub fn shelf_open_path(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        let clean_path = path.replace('/', "\\");
        let wide_file: Vec<u16> = clean_path.encode_utf16().chain(std::iter::once(0)).collect();
        let wide_op: Vec<u16> = "open".encode_utf16().chain(std::iter::once(0)).collect();

        let res = unsafe {
            ShellExecuteW(
                0,
                wide_op.as_ptr(),
                wide_file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };

        if res > 32 {
            Ok(())
        } else {
            Err(format!("ShellExecuteW failed with error code: {}", res))
        }
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn shelf_show_in_folder(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let clean_path = path.replace('/', "\\");
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", clean_path))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Ok(())
    }
}

#[tauri::command]
pub fn shelf_copy_path(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let size_bytes = wide.len() * std::mem::size_of::<u16>();

        unsafe {
            if OpenClipboard(0) == 0 {
                return Err("Failed to open clipboard".to_string());
            }
            EmptyClipboard();

            let hmem = GlobalAlloc(GMEM_MOVEABLE, size_bytes);
            if hmem == 0 {
                CloseClipboard();
                return Err("Failed to allocate global memory for clipboard".to_string());
            }

            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                CloseClipboard();
                return Err("Failed to lock global memory for clipboard".to_string());
            }

            std::ptr::copy_nonoverlapping(wide.as_ptr() as *const std::ffi::c_void, ptr, size_bytes);
            GlobalUnlock(hmem);

            if SetClipboardData(CF_UNICODETEXT, hmem) == 0 {
                CloseClipboard();
                return Err("Failed to set clipboard data".to_string());
            }

            CloseClipboard();
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Ok(())
    }
}

// 1x1 transparent PNG fallback drag cursor
const TRANSPARENT_PNG: &[u8] = &[
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0,
    0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10,
    45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
];

#[tauri::command]
pub fn shelf_start_drag(window: tauri::WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    let path_bufs: Vec<PathBuf> = paths
        .into_iter()
        .map(|p| PathBuf::from(p.trim().trim_matches('"').replace('/', "\\")))
        .collect();
    if path_bufs.is_empty() {
        return Ok(());
    }

    let preview_image = drag::Image::Raw(TRANSPARENT_PNG.to_vec());
    let res = drag::start_drag(
        &window,
        drag::DragItem::Files(path_bufs),
        preview_image,
        |_result, _pos| {},
        drag::Options::default(),
    );
    if let Err(e) = res {
        eprintln!("drag::start_drag error: {:?}", e);
        return Err(format!("{:?}", e));
    }
    Ok(())
}
