use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::process::{exit, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

const PIPE_NAME: &str = r"\\.\pipe\kumanotch";
static MSG_COUNTER: AtomicU64 = AtomicU64::new(1);

fn generate_id() -> String {
    let now = Instant::now().elapsed().as_nanos();
    let count = MSG_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("kuma-{}-{}", now, count)
}

fn send_pipe_message(json_payload: &str) -> bool {
    if json_payload.len() > 4096 {
        eprintln!("[kuma] Error: payload exceeds 4 KB maximum limit.");
        return false;
    }

    match OpenOptions::new().write(true).open(PIPE_NAME) {
        Ok(mut pipe) => {
            if let Err(e) = pipe.write_all(json_payload.as_bytes()) {
                eprintln!("[kuma] Failed to write message to KumaNotch pipe: {}", e);
                false
            } else {
                let _ = pipe.flush();
                true
            }
        }
        Err(_) => {
            // KumaNotch might not be running; don't break the user's terminal workflow
            false
        }
    }
}

fn resolve_program(program: &str) -> String {
    let direct = std::path::Path::new(program);
    if direct.exists() {
        return program.to_string();
    }

    if let Ok(path_var) = env::var("PATH") {
        let pathext_var = env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
        let extensions: Vec<&str> = pathext_var.split(';').filter(|s| !s.is_empty()).collect();

        for dir in env::split_paths(&path_var) {
            let direct_in_dir = dir.join(program);
            if direct_in_dir.is_file() {
                return direct_in_dir.to_string_lossy().to_string();
            }

            for ext in &extensions {
                let with_ext = dir.join(format!("{}{}", program, ext.to_lowercase()));
                if with_ext.is_file() {
                    return with_ext.to_string_lossy().to_string();
                }
                let with_ext_upper = dir.join(format!("{}{}", program, ext));
                if with_ext_upper.is_file() {
                    return with_ext_upper.to_string_lossy().to_string();
                }
            }
        }
    }

    program.to_string()
}

fn handle_run(args: &[String]) {
    if args.is_empty() {
        eprintln!("Usage: kuma run [--post-action <sleep|lock|chime>] <command> [args...]");
        exit(1);
    }

    let mut post_action: Option<String> = None;
    let mut cmd_start_idx = 0;

    if args.len() >= 3 && args[0] == "--post-action" {
        post_action = Some(args[1].clone());
        cmd_start_idx = 2;
    } else if args.len() >= 2 && args[0].starts_with("--post-action=") {
        post_action = Some(args[0].trim_start_matches("--post-action=").to_string());
        cmd_start_idx = 1;
    }

    if cmd_start_idx >= args.len() {
        eprintln!("Usage: kuma run [--post-action <sleep|lock|chime>] <command> [args...]");
        exit(1);
    }

    let raw_program = &args[cmd_start_idx];
    let cmd_args = &args[cmd_start_idx + 1..];
    let full_command_str = args[cmd_start_idx..].join(" ");
    let id = generate_id();

    // 1. Notify KumaNotch that command is starting
    let start_payload = serde_json::json!({
        "id": id,
        "command": full_command_str,
        "status": "running",
        "duration_ms": 0,
        "post_action": post_action
    });
    send_pipe_message(&start_payload.to_string());

    // 2. Execute process with inherited terminal stdio (no shell string interpolation)
    let resolved_program = resolve_program(raw_program);
    let start_time = Instant::now();

    let mut command = Command::new(&resolved_program);
    command
        .args(cmd_args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[kuma] Failed to start '{}': {}", resolved_program, e);
            let elapsed_ms = start_time.elapsed().as_millis() as u64;
            let err_payload = serde_json::json!({
                "id": id,
                "command": full_command_str,
                "status": "error",
                "exit_code": 1,
                "duration_ms": elapsed_ms,
                "message": format!("Failed to spawn: {}", e)
            });
            send_pipe_message(&err_payload.to_string());
            exit(1);
        }
    };

    let wait_res = child.wait();
    let elapsed_ms = start_time.elapsed().as_millis() as u64;

    let (exit_code, status) = match wait_res {
        Ok(status) => {
            let code = status.code().unwrap_or(0);
            if code == 0 {
                (0, "success")
            } else {
                (code, "error")
            }
        }
        Err(e) => {
            eprintln!("[kuma] Error waiting for process: {}", e);
            (1, "error")
        }
    };

    // 3. Notify KumaNotch of completion
    let completion_payload = serde_json::json!({
        "id": id,
        "command": full_command_str,
        "status": status,
        "exit_code": exit_code,
        "duration_ms": elapsed_ms,
        "post_action": post_action
    });
    send_pipe_message(&completion_payload.to_string());

    exit(exit_code);
}

fn handle_notify(args: &[String]) {
    if args.is_empty() {
        eprintln!("Usage: kuma notify <title> [message] [--status <success|error>]");
        exit(1);
    }

    let title = &args[0];
    let message = if args.len() > 1 && !args[1].starts_with("--") {
        Some(args[1].clone())
    } else {
        None
    };

    let status = if args.contains(&"--error".to_string()) {
        "error"
    } else {
        "success"
    };

    let id = generate_id();
    let payload = serde_json::json!({
        "id": id,
        "command": title,
        "status": status,
        "exit_code": 0,
        "duration_ms": 0,
        "message": message
    });

    if send_pipe_message(&payload.to_string()) {
        println!("[kuma] Notification sent to KumaNotch.");
    } else {
        println!("[kuma] KumaNotch is offline or named pipe unavailable.");
    }
}

fn handle_watch(args: &[String]) {
    if args.is_empty() {
        eprintln!("Usage: kuma watch <PID> [command-name] [--post-action <sleep|lock|chime>]");
        exit(1);
    }

    let pid: u32 = match args[0].parse() {
        Ok(p) => p,
        Err(_) => {
            eprintln!("[kuma] Invalid PID '{}': must be a positive integer", args[0]);
            exit(1);
        }
    };

    let mut name = None;
    let mut post_action = None;

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--post-action" && i + 1 < args.len() {
            post_action = Some(args[i + 1].clone());
            i += 2;
        } else if args[i].starts_with("--post-action=") {
            post_action = Some(args[i].trim_start_matches("--post-action=").to_string());
            i += 1;
        } else {
            name = Some(args[i].clone());
            i += 1;
        }
    }

    let payload = serde_json::json!({
        "type": "watch_pid",
        "pid": pid,
        "command": name.unwrap_or_else(|| format!("PID {}", pid)),
        "post_action": post_action
    });

    if send_pipe_message(&payload.to_string()) {
        println!("[kuma] Watching PID {} via KumaNotch (event-driven).", pid);
    } else {
        eprintln!("[kuma] Error: Failed to connect to KumaNotch named pipe.");
        exit(1);
    }
}

fn handle_status() {
    match OpenOptions::new().write(true).open(PIPE_NAME) {
        Ok(_) => {
            println!("KumaNotch daemon is online (Named Pipe \\\\.\\pipe\\kumanotch)");
        }
        Err(_) => {
            println!("KumaNotch daemon is offline (Named Pipe \\\\.\\pipe\\kumanotch not found)");
            exit(1);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        println!("KumaNotch CLI (v0.1.0)");
        println!("Commands:");
        println!("  kuma run <cmd> [args...]       Run command, forward stdio, notify notch on completion");
        println!("  kuma notify <title> [message]  Show transient status card on KumaNotch island");
        println!("  kuma watch <pid> [name]        Monitor external PID until exit (event-driven)");
        println!("  kuma status                    Check if KumaNotch daemon is running");
        return;
    }

    match args[0].as_str() {
        "run" => handle_run(&args[1..]),
        "notify" => handle_notify(&args[1..]),
        "watch" => handle_watch(&args[1..]),
        "status" => handle_status(),
        _ => {
            // Default: treat as `kuma run <args>`
            handle_run(&args);
        }
    }
}

#[cfg(test)]
#[allow(dead_code)]
#[path = "../process_watcher.rs"]
mod process_watcher;


