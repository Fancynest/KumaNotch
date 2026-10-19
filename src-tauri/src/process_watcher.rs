use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ProcessEvent {
    pub id: String,
    pub command: String,
    pub status: String, // "running" | "success" | "error"
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
    pub message: Option<String>,
}

#[derive(Deserialize, Debug)]
struct NotifyPayload {
    title: Option<String>,
    message: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RunPayload {
    command: String,
    cwd: Option<String>,
}


pub fn start_process_watcher(app_handle: AppHandle) {
    let port = 45454;
    let listener = match TcpListener::bind(format!("127.0.0.1:{}", port)) {
        Ok(l) => {
            log::info!("ProcessWatcher: HTTP listener active on 127.0.0.1:{}", port);
            l
        }
        Err(e) => {
            log::warn!("ProcessWatcher: Failed to bind to 127.0.0.1:{}: {:?}", port, e);
            return;
        }
    };

    thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(stream) = stream {
                let app = app_handle.clone();
                thread::spawn(move || {
                    handle_connection(stream, app);
                });
            }
        }
    });
}

fn handle_connection(mut stream: TcpStream, app: AppHandle) {
    let mut buffer = [0u8; 4096];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let mut lines = request.lines();
    let first_line = lines.next().unwrap_or_default();
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts.next().unwrap_or_default();

    // Extract body if POST
    let body = if let Some(pos) = request.find("\r\n\r\n") {
        &request[pos + 4..]
    } else {
        ""
    };

    let (status_code, response_body) = match (method, path) {
        ("GET", "/status") => (
            "200 OK",
            r#"{"status":"ok","app":"kumanotch","version":"0.1.0"}"#.to_string(),
        ),
        ("POST", "/notify") => {
            if let Ok(payload) = serde_json::from_str::<NotifyPayload>(body) {
                let event = ProcessEvent {
                    id: format!("proc-{}", Instant::now().elapsed().as_nanos()),
                    command: payload.title.unwrap_or_else(|| "Notification".to_string()),
                    status: payload.status.unwrap_or_else(|| "success".to_string()),
                    exit_code: Some(0),
                    duration_ms: 0,
                    message: payload.message,
                };
                let _ = app.emit("process_event", event);
                ("200 OK", r#"{"status":"notified"}"#.to_string())
            } else {
                ("400 Bad Request", r#"{"error":"invalid json payload"}"#.to_string())
            }
        }
        ("POST", "/run") => {
            if let Ok(payload) = serde_json::from_str::<RunPayload>(body) {
                let cmd_str = payload.command.clone();
                let cwd_opt = payload.cwd.clone();
                let app_clone = app.clone();
                let proc_id = format!("proc-{}", Instant::now().elapsed().as_nanos());

                // Emit start event immediately
                let start_event = ProcessEvent {
                    id: proc_id.clone(),
                    command: cmd_str.clone(),
                    status: "running".to_string(),
                    exit_code: None,
                    duration_ms: 0,
                    message: None,
                };
                let _ = app.emit("process_event", start_event);

                // Run in background thread
                thread::spawn(move || {
                    let start_time = Instant::now();
                    let mut cmd = if cfg!(windows) {
                        let mut c = std::process::Command::new("cmd.exe");
                        c.args(["/C", &cmd_str]);
                        c
                    } else {
                        let mut c = std::process::Command::new("sh");
                        c.args(["-c", &cmd_str]);
                        c
                    };

                    if let Some(dir) = cwd_opt {
                        cmd.current_dir(dir);
                    }

                    let status_res = cmd.status();
                    let duration = start_time.elapsed().as_millis() as u64;

                    let (exit_code, status_str) = match status_res {
                        Ok(s) => {
                            let code = s.code().unwrap_or(0);
                            let st = if s.success() { "success" } else { "error" };
                            (Some(code), st.to_string())
                        }
                        Err(e) => (Some(-1), format!("error: {}", e)),
                    };

                    let finish_event = ProcessEvent {
                        id: proc_id,
                        command: cmd_str,
                        status: status_str,
                        exit_code,
                        duration_ms: duration,
                        message: None,
                    };

                    let _ = app_clone.emit("process_event", finish_event);
                });

                ("200 OK", r#"{"status":"running"}"#.to_string())
            } else {
                ("400 Bad Request", r#"{"error":"invalid json payload"}"#.to_string())
            }
        }
        _ => ("404 Not Found", r#"{"error":"not found"}"#.to_string()),
    };

    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
        status_code,
        response_body.len(),
        response_body
    );

    let _ = stream.write_all(response.as_bytes());
}

#[tauri::command]
pub fn kuma_run_command(app: AppHandle, command: String) -> Result<String, String> {
    let proc_id = format!("proc-{}", Instant::now().elapsed().as_nanos());
    let cmd_str = command.clone();
    let app_clone = app.clone();

    let start_event = ProcessEvent {
        id: proc_id.clone(),
        command: cmd_str.clone(),
        status: "running".to_string(),
        exit_code: None,
        duration_ms: 0,
        message: None,
    };
    let _ = app.emit("process_event", start_event);

    thread::spawn(move || {
        let start_time = Instant::now();
        let mut cmd = std::process::Command::new("cmd.exe");
        cmd.args(["/C", &cmd_str]);

        let status_res = cmd.status();
        let duration = start_time.elapsed().as_millis() as u64;

        let (exit_code, status_str) = match status_res {
            Ok(s) => {
                let code = s.code().unwrap_or(0);
                let st = if s.success() { "success" } else { "error" };
                (Some(code), st.to_string())
            }
            Err(e) => (Some(-1), format!("error: {}", e)),
        };

        let finish_event = ProcessEvent {
            id: proc_id,
            command: cmd_str,
            status: status_str,
            exit_code,
            duration_ms: duration,
            message: None,
        };

        let _ = app_clone.emit("process_event", finish_event);
    });

    Ok("Process launched".to_string())
}
