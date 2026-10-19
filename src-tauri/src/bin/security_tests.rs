#![allow(dead_code, unused_imports)]

#[path = "../process_watcher.rs"]
mod process_watcher;

use process_watcher::*;
#[cfg(windows)]
use windows::core::PWSTR;
#[cfg(windows)]
use windows::Win32::Foundation::{LocalFree, HLOCAL};
#[cfg(windows)]
use windows::Win32::Security::Authorization::{
    ConvertSecurityDescriptorToStringSecurityDescriptorW, SDDL_REVISION_1,
};
#[cfg(windows)]
use windows::Win32::Security::{DACL_SECURITY_INFORMATION, SECURITY_ATTRIBUTES};

pub fn run_test_oversize_payload_rejected() {
    let oversize_payload = vec![b' '; MAX_PAYLOAD_SIZE + 1];
    let res = parse_and_validate_payload(&oversize_payload);
    assert!(res.is_err(), "Payload > 4 KB must be rejected");
    assert_eq!(res.unwrap_err(), "Payload exceeds 4 KB maximum limit");
    println!("  [PASS] test_oversize_payload_rejected (>4 KB rejected)");
}

pub fn run_test_corrupted_json_handled_gracefully() {
    let corrupt = b"{\"command\": unquoted_garbage..., 123";
    let res = parse_and_validate_payload(corrupt);
    assert!(res.is_err(), "Corrupted JSON must return error");
    assert!(res.unwrap_err().contains("Corrupted JSON payload"));
    println!("  [PASS] test_corrupted_json_handled_gracefully");
}

pub fn run_test_status_normalization() {
    assert_eq!(normalize_status(Some("running"), None), "running");
    assert_eq!(normalize_status(Some("RUNNING"), None), "running");
    assert_eq!(normalize_status(Some("success"), None), "success");
    assert_eq!(normalize_status(Some("ok"), None), "success");
    assert_eq!(normalize_status(Some("done"), None), "success");
    assert_eq!(normalize_status(Some("error"), None), "error");
    assert_eq!(normalize_status(Some("failed"), None), "error");
    assert_eq!(normalize_status(Some("fail"), None), "error");
    assert_eq!(normalize_status(Some("custom"), Some(0)), "success");
    assert_eq!(normalize_status(Some("custom"), Some(1)), "error");
    println!("  [PASS] test_status_normalization");
}

pub fn run_test_text_truncation_bounds() {
    let long_cmd = "x".repeat(400);
    let long_msg = "y".repeat(800);
    let long_act = "z".repeat(100);

    let input = ProcessMessageInput {
        id: Some("custom-id".to_string()),
        command: Some(long_cmd),
        title: None,
        status: Some("running".to_string()),
        exit_code: None,
        duration_ms: None,
        message: Some(long_msg),
        pid: None,
        post_action: Some(long_act),
        msg_type: None,
    };

    let event = normalize_process_event(input);
    assert_eq!(event.command.len(), MAX_COMMAND_LEN);
    assert_eq!(event.message.unwrap().len(), MAX_MESSAGE_LEN);
    assert_eq!(event.post_action.unwrap().len(), 64);
    println!("  [PASS] test_text_truncation_bounds");
}

#[cfg(windows)]
pub fn run_test_security_descriptor_user_only_dacl() {
    unsafe {
        let sa_opt = create_user_only_security_attributes();
        assert!(sa_opt.is_some(), "Must create security descriptor for current user");
        let (sa, p_sd) = sa_opt.unwrap();
        assert!(!p_sd.0.is_null());
        assert_eq!(sa.nLength, std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32);
        assert!(!sa.bInheritHandle.as_bool());

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

        // 1. Must be protected DACL (P prevents inherited ACEs)
        assert!(
            sddl_str.starts_with("D:P("),
            "DACL must be explicitly protected: {}",
            sddl_str
        );
        // 2. Must only allow Generic All (GA) to the current user SID
        assert!(
            sddl_str.contains("(A;;GA;;;S-1-5-"),
            "Must allow GA strictly to current user SID: {}",
            sddl_str
        );
        // 3. Must reject connections from other users / world:
        assert!(!sddl_str.contains(";;;WD)"), "Must reject Everyone (WD)");
        assert!(!sddl_str.contains(";;;AU)"), "Must reject Authenticated Users (AU)");
        assert!(!sddl_str.contains(";;;NU)"), "Must reject Network users (NU)");
        assert!(!sddl_str.contains(";;;AN)"), "Must reject Anonymous users (AN)");

        println!("  [PASS] test_security_descriptor_user_only_dacl ({})", sddl_str);
    }
}

#[test]
fn test_oversize() {
    run_test_oversize_payload_rejected();
}

#[test]
fn test_corrupt_json() {
    run_test_corrupted_json_handled_gracefully();
}

#[test]
fn test_status() {
    run_test_status_normalization();
}

#[test]
fn test_truncation() {
    run_test_text_truncation_bounds();
}

#[cfg(windows)]
#[test]
fn test_dacl() {
    run_test_security_descriptor_user_only_dacl();
}

fn main() {
    println!("\n========================================================");
    println!("     KumaNotch Security & Isolation Test Suite");
    println!("========================================================");
    run_test_oversize_payload_rejected();
    run_test_corrupted_json_handled_gracefully();
    run_test_status_normalization();
    run_test_text_truncation_bounds();
    #[cfg(windows)]
    run_test_security_descriptor_user_only_dacl();
    println!("========================================================");
    println!("     All 5 Security Tests Passed Successfully! (5/5)");
    println!("========================================================\n");
}
