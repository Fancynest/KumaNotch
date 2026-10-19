#![allow(unsafe_op_in_unsafe_fn)]

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(windows)]
use windows::core::{PCWSTR, PWSTR};
#[cfg(windows)]
use windows::Win32::Foundation::{CloseHandle, LocalFree, HANDLE, HLOCAL, WAIT_OBJECT_0};


#[cfg(windows)]
use windows::Win32::Security::{
    Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
        SDDL_REVISION_1,
    },
    GetTokenInformation, TokenUser, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY,
    TOKEN_USER,
};
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    FlushFileBuffers, ReadFile, FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX,
};
#[cfg(windows)]
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PeekNamedPipe, PIPE_READMODE_BYTE,
    PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};
#[cfg(windows)]
use windows::Win32::System::Power::{
    SetThreadExecutionState, ES_CONTINUOUS, ES_SYSTEM_REQUIRED,
};
#[cfg(windows)]
use windows::Win32::System::Threading::{
    GetCurrentProcess, GetExitCodeProcess, OpenProcess, OpenProcessToken, WaitForSingleObject,
    INFINITE, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
};

pub const PIPE_NAME: &str = r"\\.\pipe\kumanotch";
pub const MAX_PAYLOAD_SIZE: usize = 4096; // Strictly 4 KB max
pub const MAX_COMMAND_LEN: usize = 256;
pub const MAX_MESSAGE_LEN: usize = 512;

static PROCESS_COUNTER: AtomicU64 = AtomicU64::new(1);
static KEEP_AWAKE_TX: OnceLock<Sender<bool>> = OnceLock::new();

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct ProcessEvent {
    pub id: String,
    pub command: String,
    pub status: String, // strictly "running" | "success" | "error"
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
    pub message: Option<String>,
    pub post_action: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ProcessMessageInput {
    pub id: Option<String>,
    pub command: Option<String>,
    pub title: Option<String>,
    pub status: Option<String>,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<u64>,
    pub message: Option<String>,
    pub pid: Option<u32>,
    pub post_action: Option<String>,
    #[serde(rename = "type")]
    #[allow(dead_code)]
    pub msg_type: Option<String>,
}

pub fn generate_process_id() -> String {
    let now = Instant::now().elapsed().as_millis();
    let count = PROCESS_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("proc-{}-{}", now, count)
}

pub fn normalize_status(raw: Option<&str>, exit_code: Option<i32>) -> String {
    match raw.unwrap_or_default().to_lowercase().as_str() {
        "running" => "running".to_string(),
        "success" | "ok" | "done" => "success".to_string(),
        "error" | "fail" | "failed" | "err" | "crash" => "error".to_string(),
        _ => {
            if let Some(code) = exit_code {
                if code == 0 {
                    "success".to_string()
                } else {
                    "error".to_string()
                }
            } else {
                "success".to_string()
            }
        }
    }
}

pub fn truncate_string(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

// ─── Keep-Awake Dedicated Thread ──────────────────────────────────
pub fn init_keep_awake_thread() {
    KEEP_AWAKE_TX.get_or_init(|| {
        let (tx, rx) = channel::<bool>();
        thread::Builder::new()
            .name("kumanotch-keep-awake".to_string())
            .spawn(move || {
                #[cfg(windows)]
                unsafe {
                    let mut active_count: usize = 0;
                    while let Ok(activate) = rx.recv() {
                        if activate {
                            active_count = active_count.saturating_add(1);
                        } else {
                            active_count = active_count.saturating_sub(1);
                        }

                        if active_count > 0 {
                            // Hold ES_CONTINUOUS | ES_SYSTEM_REQUIRED
                            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED);
                            log::debug!("ProcessWatcher: Keep-Awake engaged (active={})", active_count);
                        } else {
                            // Release execution state back to continuous normal
                            SetThreadExecutionState(ES_CONTINUOUS);
                            log::debug!("ProcessWatcher: Keep-Awake released");
                        }
                    }
                    SetThreadExecutionState(ES_CONTINUOUS);
                }
            })
            .expect("failed to spawn keep-awake thread");
        tx
    });
}

pub fn trigger_keep_awake(activate: bool) {
    if let Some(tx) = KEEP_AWAKE_TX.get() {
        let _ = tx.send(activate);
    }
}

// ─── Windows Security Descriptor Restricted to Current User SID ───
#[cfg(windows)]
pub unsafe fn create_user_only_security_attributes() -> Option<(SECURITY_ATTRIBUTES, PSECURITY_DESCRIPTOR)> {
    let mut token_handle = HANDLE::default();
    if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle).is_err() {
        return None;
    }

    let mut return_length = 0u32;
    let _ = GetTokenInformation(token_handle, TokenUser, None, 0, &mut return_length);
    if return_length == 0 {
        let _ = CloseHandle(token_handle);
        return None;
    }

    let mut buffer = vec![0u8; return_length as usize];
    if GetTokenInformation(
        token_handle,
        TokenUser,
        Some(buffer.as_mut_ptr() as *mut _),
        return_length,
        &mut return_length,
    )
    .is_err()
    {
        let _ = CloseHandle(token_handle);
        return None;
    }
    let _ = CloseHandle(token_handle);

    let token_user = &*(buffer.as_ptr() as *const TOKEN_USER);
    let mut sid_string: PWSTR = PWSTR::null();
    if ConvertSidToStringSidW(token_user.User.Sid, &mut sid_string).is_err() {
        return None;
    }

    let sid_str = sid_string.to_string().ok()?;
    let _ = LocalFree(Some(HLOCAL(sid_string.as_ptr() as _)));

    // SDDL: D:P(A;;GA;;;SID) -> Discretionary ACL, Protected (no inheritance), Allow Generic All only to user SID
    let sddl = format!("D:P(A;;GA;;;{})", sid_str);
    let wide_sddl: Vec<u16> = sddl.encode_utf16().chain(std::iter::once(0)).collect();

    let mut p_sd = PSECURITY_DESCRIPTOR::default();
    if ConvertStringSecurityDescriptorToSecurityDescriptorW(
        PCWSTR(wide_sddl.as_ptr()),
        SDDL_REVISION_1,
        &mut p_sd,
        None,
    )
    .is_err()
    {
        return None;
    }

    let sa = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: p_sd.0,
        bInheritHandle: false.into(),
    };

    Some((sa, p_sd))
}

// ─── Mode A: Event-Driven PID Monitoring (Zero Polling) ───────────
pub fn watch_process_pid(
    pid: u32,
    command_name: Option<String>,
    post_action: Option<String>,
    app: AppHandle,
) {
    thread::spawn(move || {
        #[cfg(windows)]
        unsafe {
            let h_process = match OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                false,
                pid,
            ) {
                Ok(h) if !h.is_invalid() => h,
                _ => {
                    log::warn!("ProcessWatcher: Unable to open process PID {}", pid);
                    return;
                }
            };

            let cmd_display = command_name.unwrap_or_else(|| format!("PID {}", pid));
            let clean_cmd = truncate_string(&cmd_display, MAX_COMMAND_LEN);
            let id = generate_process_id();
            let start = Instant::now();

            trigger_keep_awake(true);

            // Emit initial running event
            let running_event = ProcessEvent {
                id: id.clone(),
                command: clean_cmd.clone(),
                status: "running".to_string(),
                exit_code: None,
                duration_ms: 0,
                message: Some(format!("Memantau PID {}", pid)),
                post_action: post_action.clone(),
            };
            let _ = app.emit("process_event", &running_event);

            // 100% EVENT-DRIVEN: Kernel blocks until process terminates (0.00% CPU)
            let wait_res = WaitForSingleObject(h_process, INFINITE);

            let duration_ms = start.elapsed().as_millis() as u64;
            trigger_keep_awake(false);

            let mut exit_code = 0u32;
            let _ = GetExitCodeProcess(h_process, &mut exit_code);
            let _ = CloseHandle(h_process);

            let status = if wait_res == WAIT_OBJECT_0 && exit_code == 0 {
                "success".to_string()
            } else {
                "error".to_string()
            };

            let completed_event = ProcessEvent {
                id,
                command: clean_cmd,
                status,
                exit_code: Some(exit_code as i32),
                duration_ms,
                message: Some(format!("Proses PID {} selesai", pid)),
                post_action,
            };
            let _ = app.emit("process_event", &completed_event);
        }
    });
}

// ─── Payload Validation & Parsing ─────────────────────────────────
pub fn parse_and_validate_payload(data: &[u8]) -> Result<ProcessMessageInput, String> {
    if data.len() > MAX_PAYLOAD_SIZE {
        return Err("Payload exceeds 4 KB maximum limit".to_string());
    }
    serde_json::from_slice::<ProcessMessageInput>(data)
        .map_err(|e| format!("Corrupted JSON payload: {}", e))
}

pub fn normalize_process_event(input: ProcessMessageInput) -> ProcessEvent {
    let id = input.id.unwrap_or_else(generate_process_id);
    let raw_cmd = input
        .command
        .or(input.title)
        .unwrap_or_else(|| "Process".to_string());
    let command = truncate_string(&raw_cmd, MAX_COMMAND_LEN);

    let status = normalize_status(input.status.as_deref(), input.exit_code);
    let message = input.message.map(|m| truncate_string(&m, MAX_MESSAGE_LEN));
    let post_action = input.post_action.map(|a| truncate_string(&a, 64));

    ProcessEvent {
        id,
        command,
        status,
        exit_code: input.exit_code,
        duration_ms: input.duration_ms.unwrap_or(0),
        message,
        post_action,
    }
}

pub fn handle_client_payload(data: &[u8], app: &AppHandle) -> Result<ProcessEvent, String> {
    let input = parse_and_validate_payload(data)?;

    // Handle Mode A PID monitoring if requested
    if let Some(pid) = input.pid {
        watch_process_pid(pid, input.command.clone(), input.post_action.clone(), app.clone());
    }

    let event = normalize_process_event(input);

    // Keep-awake hook
    if event.status == "running" {
        trigger_keep_awake(true);
    } else {
        trigger_keep_awake(false);
    }

    let _ = app.emit("process_event", &event);
    Ok(event)
}

// ─── Power Action Handling ────────────────────────────────────────
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ValidatedPowerAction {
    Sleep,
    Lock,
    Shutdown,
}

pub fn parse_power_action(action: &str) -> Result<ValidatedPowerAction, String> {
    match action.trim().to_lowercase().as_str() {
        "sleep" => Ok(ValidatedPowerAction::Sleep),
        "lock" => Ok(ValidatedPowerAction::Lock),
        "shutdown" => Ok(ValidatedPowerAction::Shutdown),
        other => Err(format!(
            "Invalid power action: '{}'. Valid actions: sleep, lock, shutdown",
            other
        )),
    }
}

#[tauri::command]
pub fn power_action(action: String) -> Result<(), String> {
    let validated = parse_power_action(&action)?;
    match validated {
        ValidatedPowerAction::Sleep => {
            #[cfg(windows)]
            unsafe {
                windows::Win32::System::Power::SetSuspendState(false.into(), false.into(), false.into());
            }
            Ok(())
        }
        ValidatedPowerAction::Lock => {
            #[cfg(windows)]
            unsafe {
                let _ = windows::Win32::System::Shutdown::LockWorkStation();
            }
            Ok(())
        }
        ValidatedPowerAction::Shutdown => {
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("shutdown")
                    .args(["/s", "/t", "0"])
                    .spawn()
                    .map_err(|e| format!("Failed to initiate shutdown: {}", e))?;
            }
            Ok(())
        }
    }
}

// ─── Running Processes & Mode A Command ───────────────────────────
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ProcessSummary {
    pub pid: u32,
    pub name: String,
}

#[tauri::command]
pub fn get_running_processes() -> Result<Vec<ProcessSummary>, String> {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        };

        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| format!("Failed to snapshot processes: {}", e))?;

        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut list = Vec::new();
        let mut seen = std::collections::HashSet::new();

        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let pid = entry.th32ProcessID;
                if pid > 4 && seen.insert(pid) {
                    let len = entry
                        .szExeFile
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.szExeFile.len());
                    let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                    if !name.is_empty() {
                        list.push(ProcessSummary { pid, name });
                    }
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(list)
    }

    #[cfg(not(windows))]
    Ok(vec![])
}

#[tauri::command]
pub fn watch_process(
    pid: u32,
    name: Option<String>,
    post_action: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    watch_process_pid(pid, name, post_action, app);
    Ok(())
}

// ─── kuma.exe PATH Management ─────────────────────────────────────
pub fn find_kuma_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    // 1. Next to current executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            if parent.join("kuma.exe").exists() {
                return Some(parent.to_path_buf());
            }
            if parent.join("bin").join("kuma.exe").exists() {
                return Some(parent.join("bin"));
            }
        }
    }

    // 2. Resource directory
    if let Ok(res_dir) = app.path().resource_dir() {
        if res_dir.join("bin").join("kuma.exe").exists() {
            return Some(res_dir.join("bin"));
        }
        if res_dir.join("kuma.exe").exists() {
            return Some(res_dir);
        }
    }

    // 3. Dev target directory fallback
    if let Ok(cwd) = std::env::current_dir() {
        for sub in &["target/debug", "target/release", "src-tauri/target/debug", "src-tauri/target/release"] {
            let candidate = cwd.join(sub);
            if candidate.join("kuma.exe").exists() {
                return Some(candidate);
            }
        }
    }

    None
}

#[cfg(windows)]
unsafe extern "system" {
    fn RegOpenKeyExW(
        hkey: isize,
        sub_key: *const u16,
        options: u32,
        sam_desired: u32,
        phk_result: *mut isize,
    ) -> i32;
    fn RegQueryValueExW(
        hkey: isize,
        value_name: *const u16,
        reserved: *const u32,
        type_: *mut u32,
        data: *mut u8,
        cb_data: *mut u32,
    ) -> i32;
    fn RegSetValueExW(
        hkey: isize,
        value_name: *const u16,
        reserved: u32,
        type_: u32,
        data: *const u8,
        cb_data: u32,
    ) -> i32;
    fn RegCloseKey(hkey: isize) -> i32;
    fn SendMessageTimeoutW(
        hwnd: isize,
        msg: u32,
        wparam: usize,
        lparam: *const u16,
        flags: u32,
        timeout: u32,
        result: *mut usize,
    ) -> isize;
}

#[cfg(windows)]
const HKEY_CURRENT_USER: isize = -2147483647; // 0x80000001
#[cfg(windows)]
const KEY_QUERY_VALUE: u32 = 0x0001;
#[cfg(windows)]
const KEY_SET_VALUE: u32 = 0x0002;
#[cfg(windows)]
const REG_SZ: u32 = 1;
#[cfg(windows)]
const REG_EXPAND_SZ: u32 = 2;
#[cfg(windows)]
const HWND_BROADCAST: isize = 0xffff;
#[cfg(windows)]
const WM_SETTINGCHANGE: u32 = 0x001A;
#[cfg(windows)]
const SMTO_ABORTIFHUNG: u32 = 0x0002;

#[tauri::command]
pub fn is_kuma_in_path(app: AppHandle) -> Result<bool, String> {
    let kuma_dir = match find_kuma_dir(&app) {
        Some(dir) => dir,
        None => return Ok(false),
    };

    #[cfg(windows)]
    {
        let sub_key: Vec<u16> = "Environment\0".encode_utf16().collect();
        let val_name: Vec<u16> = "Path\0".encode_utf16().collect();

        let mut hkey: isize = 0;
        let open_res = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                sub_key.as_ptr(),
                0,
                KEY_QUERY_VALUE,
                &mut hkey,
            )
        };
        if open_res != 0 {
            return Ok(false);
        }

        let mut val_type: u32 = 0;
        let mut cb_data: u32 = 0;
        unsafe {
            RegQueryValueExW(
                hkey,
                val_name.as_ptr(),
                std::ptr::null(),
                &mut val_type,
                std::ptr::null_mut(),
                &mut cb_data,
            );
        }

        if cb_data == 0 {
            unsafe { let _ = RegCloseKey(hkey); }
            return Ok(false);
        }

        let mut buffer = vec![0u8; cb_data as usize];
        let query_res = unsafe {
            RegQueryValueExW(
                hkey,
                val_name.as_ptr(),
                std::ptr::null(),
                &mut val_type,
                buffer.as_mut_ptr(),
                &mut cb_data,
            )
        };
        unsafe { let _ = RegCloseKey(hkey); }

        if query_res != 0 {
            return Ok(false);
        }

        let u16_slice = unsafe {
            std::slice::from_raw_parts(
                buffer.as_ptr() as *const u16,
                (cb_data as usize) / std::mem::size_of::<u16>(),
            )
        };
        let len = u16_slice.iter().position(|&c| c == 0).unwrap_or(u16_slice.len());
        let current_path = String::from_utf16_lossy(&u16_slice[..len]);

        let kuma_dir_str = kuma_dir.to_string_lossy().to_lowercase();
        let in_path = current_path
            .split(';')
            .any(|p| p.trim().to_lowercase() == kuma_dir_str);
        Ok(in_path)
    }

    #[cfg(not(windows))]
    Ok(false)
}

#[tauri::command]
pub fn add_kuma_to_path(app: AppHandle) -> Result<String, String> {
    let kuma_dir = find_kuma_dir(&app)
        .ok_or_else(|| "kuma.exe tidak ditemukan di direktori aplikasi atau target".to_string())?;
    let kuma_dir_str = kuma_dir.to_string_lossy();

    #[cfg(windows)]
    {
        let sub_key: Vec<u16> = "Environment\0".encode_utf16().collect();
        let val_name: Vec<u16> = "Path\0".encode_utf16().collect();

        let mut hkey: isize = 0;
        let open_res = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                sub_key.as_ptr(),
                0,
                KEY_QUERY_VALUE | KEY_SET_VALUE,
                &mut hkey,
            )
        };
        if open_res != 0 {
            return Err(format!("RegOpenKeyExW failed with code {}", open_res));
        }

        // 1. Query current value, length, and maintain REG_EXPAND_SZ type
        let mut val_type: u32 = REG_EXPAND_SZ;
        let mut cb_data: u32 = 0;
        unsafe {
            RegQueryValueExW(
                hkey,
                val_name.as_ptr(),
                std::ptr::null(),
                &mut val_type,
                std::ptr::null_mut(),
                &mut cb_data,
            );
        }

        // Maintain REG_EXPAND_SZ as default / preserved
        if val_type != REG_SZ && val_type != REG_EXPAND_SZ {
            val_type = REG_EXPAND_SZ;
        }

        let mut current_path = String::new();
        if cb_data > 0 {
            let mut buffer = vec![0u8; cb_data as usize];
            let query_res = unsafe {
                RegQueryValueExW(
                    hkey,
                    val_name.as_ptr(),
                    std::ptr::null(),
                    &mut val_type,
                    buffer.as_mut_ptr(),
                    &mut cb_data,
                )
            };
            if query_res == 0 {
                let u16_slice = unsafe {
                    std::slice::from_raw_parts(
                        buffer.as_ptr() as *const u16,
                        (cb_data as usize) / std::mem::size_of::<u16>(),
                    )
                };
                let len = u16_slice.iter().position(|&c| c == 0).unwrap_or(u16_slice.len());
                current_path = String::from_utf16_lossy(&u16_slice[..len]);
            }
        }

        // 2. Prevent duplicate entries
        let target_norm = kuma_dir_str.trim().to_lowercase();
        let already_present = current_path
            .split(';')
            .any(|p| p.trim().to_lowercase() == target_norm);

        if !already_present {
            let new_path_str = if current_path.trim().is_empty() {
                kuma_dir_str.to_string()
            } else {
                let trimmed = current_path.trim_end_matches(';');
                format!("{};{}", trimmed, kuma_dir_str)
            };

            let wide_new_path: Vec<u16> = new_path_str
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            let bytes_len = (wide_new_path.len() * std::mem::size_of::<u16>()) as u32;

            let set_res = unsafe {
                RegSetValueExW(
                    hkey,
                    val_name.as_ptr(),
                    0,
                    val_type,
                    wide_new_path.as_ptr() as *const u8,
                    bytes_len,
                )
            };

            unsafe {
                let _ = RegCloseKey(hkey);
            }

            if set_res != 0 {
                return Err(format!("RegSetValueExW failed with code {}", set_res));
            }

            // 3. Broadcast WM_SETTINGCHANGE ("Environment") to all top-level windows
            let env_param: Vec<u16> = "Environment\0".encode_utf16().collect();
            let mut msg_result: usize = 0;
            unsafe {
                SendMessageTimeoutW(
                    HWND_BROADCAST,
                    WM_SETTINGCHANGE,
                    0,
                    env_param.as_ptr(),
                    SMTO_ABORTIFHUNG,
                    5000,
                    &mut msg_result,
                );
            }
        } else {
            unsafe {
                let _ = RegCloseKey(hkey);
            }
        }

        Ok(kuma_dir_str.to_string())
    }

    #[cfg(not(windows))]
    Ok(kuma_dir_str.to_string())
}

// ─── Server Daemon via Named Pipe \\.\pipe\kumanotch ───────────────
pub fn start_process_watcher(app_handle: AppHandle) {
    init_keep_awake_thread();

    #[cfg(windows)]
    thread::spawn(move || {
        let pipe_name: Vec<u16> = PIPE_NAME
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let sa_opt = unsafe { create_user_only_security_attributes() };
        let sa_ptr = sa_opt.as_ref().map(|(sa, _)| sa as *const SECURITY_ATTRIBUTES);

        log::info!("ProcessWatcher: Named Pipe active at {}", PIPE_NAME);

        let mut is_first_instance = true;
        let mut retry_failures: u32 = 0;

        loop {
            let open_mode = if is_first_instance {
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE
            } else {
                PIPE_ACCESS_DUPLEX
            };

            let pipe_handle = unsafe {
                CreateNamedPipeW(
                    PCWSTR(pipe_name.as_ptr()),
                    open_mode,
                    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                    PIPE_UNLIMITED_INSTANCES,
                    MAX_PAYLOAD_SIZE as u32,
                    MAX_PAYLOAD_SIZE as u32,
                    0,
                    sa_ptr,
                )
            };

            if pipe_handle.is_invalid() {
                retry_failures = retry_failures.saturating_add(1);
                if retry_failures <= 3 || retry_failures % 30 == 0 {
                    log::warn!(
                        "ProcessWatcher: CreateNamedPipeW failed (attempt {})",
                        retry_failures
                    );
                }
                thread::sleep(std::time::Duration::from_millis(500));
                continue;
            }

            is_first_instance = false;
            retry_failures = 0;

            let connected = unsafe {
                ConnectNamedPipe(pipe_handle, None).is_ok()
                    || windows::Win32::Foundation::GetLastError()
                        == windows::Win32::Foundation::ERROR_PIPE_CONNECTED
            };

            if connected {
                let app = app_handle.clone();
                let handle_val = pipe_handle.0 as isize;
                thread::spawn(move || {
                    let pipe_handle = HANDLE(handle_val as *mut _);

                    // Idle read timeout: Wait up to 3 seconds for data arrival before aborting
                    let start_wait = Instant::now();
                    let mut data_ready = false;
                    while start_wait.elapsed() < std::time::Duration::from_secs(3) {
                        let mut bytes_avail = 0u32;
                        let peek_ok = unsafe {
                            PeekNamedPipe(
                                pipe_handle,
                                None,
                                0,
                                None,
                                Some(&mut bytes_avail),
                                None,
                            )
                        };
                        if peek_ok.is_err() {
                            break;
                        }
                        if bytes_avail > 0 {
                            data_ready = true;
                            break;
                        }
                        thread::sleep(std::time::Duration::from_millis(50));
                    }

                    if !data_ready {
                        unsafe {
                            let _ = DisconnectNamedPipe(pipe_handle);
                            let _ = CloseHandle(pipe_handle);
                        }
                        return;
                    }

                    let mut buffer = [0u8; MAX_PAYLOAD_SIZE];
                    let mut bytes_read = 0u32;

                    let read_ok = unsafe {
                        ReadFile(
                            pipe_handle,
                            Some(&mut buffer),
                            Some(&mut bytes_read),
                            None,
                        )
                    };

                    if read_ok.is_ok() && bytes_read > 0 {
                        // Check if oversized data remains in the pipe
                        let mut bytes_avail = 0u32;
                        let _ = unsafe {
                            PeekNamedPipe(
                                pipe_handle,
                                None,
                                0,
                                None,
                                Some(&mut bytes_avail),
                                None,
                            )
                        };

                        if bytes_avail > 0 {
                            log::warn!("ProcessWatcher: Payload exceeds 4 KB limit, discarded.");
                        } else {
                            let _ = handle_client_payload(&buffer[..bytes_read as usize], &app);
                        }
                    }

                    unsafe {
                        let _ = FlushFileBuffers(pipe_handle);
                        let _ = DisconnectNamedPipe(pipe_handle);
                        let _ = CloseHandle(pipe_handle);
                    }
                });
            } else {
                unsafe {
                    let _ = CloseHandle(pipe_handle);
                }
            }
        }
    });
}

// ─── Security & Regression Unit Tests ─────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_oversize_payload_rejected() {
        // Exactly 4096 bytes is allowed
        let ok_payload = vec![b' '; MAX_PAYLOAD_SIZE];
        // 4097 bytes must be rejected
        let oversize_payload = vec![b' '; MAX_PAYLOAD_SIZE + 1];

        assert!(parse_and_validate_payload(&oversize_payload).is_err());
        assert_eq!(
            parse_and_validate_payload(&oversize_payload).unwrap_err(),
            "Payload exceeds 4 KB maximum limit"
        );
        // While valid format of 4096 is accepted (or fails on json parse, not on size)
        assert_ne!(
            parse_and_validate_payload(&ok_payload).unwrap_err(),
            "Payload exceeds 4 KB maximum limit"
        );
    }

    #[test]
    fn test_corrupted_json_handled_gracefully() {
        let corrupt = b"{\"command\": unquoted_garbage..., 123";
        let res = parse_and_validate_payload(corrupt);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Corrupted JSON payload"));
    }

    #[test]
    fn test_status_normalization() {
        assert_eq!(normalize_status(Some("running"), None), "running");
        assert_eq!(normalize_status(Some("RUNNING"), None), "running");
        assert_eq!(normalize_status(Some("success"), None), "success");
        assert_eq!(normalize_status(Some("done"), None), "success");
        assert_eq!(normalize_status(Some("error"), None), "error");
        assert_eq!(normalize_status(Some("failed"), None), "error");
        assert_eq!(normalize_status(Some("crash"), None), "error");
        // Unknown status with exit code
        assert_eq!(normalize_status(Some("random"), Some(0)), "success");
        assert_eq!(normalize_status(Some("random"), Some(1)), "error");
    }

    #[test]
    fn test_text_truncation() {
        let long_cmd = "a".repeat(300);
        let long_msg = "b".repeat(600);

        let input = ProcessMessageInput {
            id: Some("custom-id".to_string()),
            command: Some(long_cmd),
            title: None,
            status: Some("running".to_string()),
            exit_code: None,
            duration_ms: None,
            message: Some(long_msg),
            pid: None,
            post_action: Some("sleep".to_string()),
            msg_type: None,
        };

        let event = normalize_process_event(input);
        assert_eq!(event.command.len(), MAX_COMMAND_LEN);
        assert_eq!(event.message.unwrap().len(), MAX_MESSAGE_LEN);
        assert_eq!(event.status, "running");
    }

    #[cfg(windows)]
    #[test]
    fn test_security_descriptor_user_only() {
        unsafe {
            let sa_opt = create_user_only_security_attributes();
            assert!(sa_opt.is_some(), "Must create security descriptor for current user");
            let (sa, p_sd) = sa_opt.unwrap();
            assert!(!p_sd.0.is_null());
            assert_eq!(sa.nLength, std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32);
            assert!(!sa.bInheritHandle.as_bool());

            // Convert back to SDDL string to verify DACL protection and single-user constraint
            use windows::Win32::Security::Authorization::ConvertSecurityDescriptorToStringSecurityDescriptorW;
            use windows::Win32::Security::DACL_SECURITY_INFORMATION;

            let mut out_sddl = PWSTR::null();
            let conv_res = ConvertSecurityDescriptorToStringSecurityDescriptorW(
                p_sd,
                SDDL_REVISION_1,
                DACL_SECURITY_INFORMATION,
                &mut out_sddl,
                None,
            );
            assert!(conv_res.is_ok(), "Should convert security descriptor back to SDDL");
            let sddl_str = out_sddl.to_string().expect("Valid UTF-16 SDDL");
            let _ = LocalFree(Some(HLOCAL(out_sddl.as_ptr() as _)));

            // 1. Must be protected DACL (P flag prevents any inherited permissions)
            assert!(sddl_str.starts_with("D:P("), "DACL must be explicitly protected: {}", sddl_str);
            // 2. Must only allow Generic All (GA) to the current user SID
            assert!(sddl_str.contains("(A;;GA;;;S-1-5-"), "Must allow GA strictly to current user SID: {}", sddl_str);
            // 3. Must NOT contain World / Everyone (WD), Authenticated Users (AU), Network (NU), or Anonymous (AN)
            assert!(!sddl_str.contains(";;;WD)"), "Must reject Everyone (WD)");
            assert!(!sddl_str.contains(";;;AU)"), "Must reject Authenticated Users (AU)");
            assert!(!sddl_str.contains(";;;NU)"), "Must reject Network users (NU)");
            assert!(!sddl_str.contains(";;;AN)"), "Must reject Anonymous users (AN)");
        }
    }

    #[test]
    fn test_parse_power_action() {
        assert_eq!(parse_power_action("sleep").unwrap(), ValidatedPowerAction::Sleep);
        assert_eq!(parse_power_action("SLEEP ").unwrap(), ValidatedPowerAction::Sleep);
        assert_eq!(parse_power_action("lock").unwrap(), ValidatedPowerAction::Lock);
        assert_eq!(parse_power_action("shutdown").unwrap(), ValidatedPowerAction::Shutdown);
        assert!(parse_power_action("reboot").is_err());
        assert!(parse_power_action("").is_err());
        assert!(parse_power_action("calc.exe").is_err());
    }
}
