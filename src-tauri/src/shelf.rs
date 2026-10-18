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
        let p = Path::new(&p_str);
        let exists = p.exists();
        let is_dir = p.is_dir();
        let name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| p_str.clone());
        let size = if is_dir {
            0
        } else {
            std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)
        };
        let extension = p
            .extension()
            .map(|e| e.to_string_lossy().to_string().to_lowercase())
            .unwrap_or_default();

        results.push(ShelfMetadata {
            path: p_str,
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
        let exists = Path::new(&p_str).exists();
        map.insert(p_str, exists);
    }
    map
}

#[tauri::command]
pub fn shelf_open_path(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let clean_path = path.replace('/', "\\");
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &clean_path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
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
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut child = std::process::Command::new("clip.exe")
            .stdin(std::process::Stdio::piped())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;

        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            let _ = stdin.write_all(path.as_bytes());
            drop(stdin);
        }
        let _ = child.wait();
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
    let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    if path_bufs.is_empty() {
        return Ok(());
    }

    let preview_image = drag::Image::Raw(TRANSPARENT_PNG.to_vec());
    let _ = drag::start_drag(
        &window,
        drag::DragItem::Files(path_bufs),
        preview_image,
        |_result, _pos| {},
        drag::Options::default(),
    );
    Ok(())
}
