#![allow(unsafe_op_in_unsafe_fn)]

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

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
use windows::Win32::Storage::FileSystem::{FlushFileBuffers, ReadFile, PIPE_ACCESS_DUPLEX};
#[cfg(windows)]
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PeekNamedPipe, PIPE_READMODE_BYTE,
    PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};
#[cfg(windows)]
use windows::Win32::System::Power::{
    SetThreadExecutionState, ES_AWAYMODE_REQUIRED, ES_CONTINUOUS, ES_SYSTEM_REQUIRED,
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
        "error" | "fail" | "failed" | "err" => "error".to_string(),
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
                            // Hold ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED
                            SetThreadExecutionState(
                                ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED,
                            );
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

        loop {
            let pipe_handle = unsafe {
                CreateNamedPipeW(
                    PCWSTR(pipe_name.as_ptr()),
                    PIPE_ACCESS_DUPLEX,
                    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                    PIPE_UNLIMITED_INSTANCES,
                    MAX_PAYLOAD_SIZE as u32,
                    MAX_PAYLOAD_SIZE as u32,
                    0,
                    sa_ptr,
                )
            };

            if pipe_handle.is_invalid() {
                log::warn!("ProcessWatcher: CreateNamedPipeW failed");
                thread::sleep(std::time::Duration::from_millis(500));
                continue;
            }

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
}
