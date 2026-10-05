use crate::bin_resolver::python3_path;
use serde::Serialize;
use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Serialize)]
pub struct PythonResult {
    stdout: String,
    stderr: String,
    code: i32,
}

#[tauri::command]
pub fn run_python(code: String) -> Result<PythonResult, String> {
    let bin = python3_path().ok_or(
        "Could not find `python3` on your system. Install Python from python.org or via Homebrew.".to_string()
    )?;
    let mut child = Command::new(bin)
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("python3 failed to start: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(code.as_bytes())
            .map_err(|e| format!("write to python3 stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("wait for python3: {}", e))?;

    Ok(PythonResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        code: output.status.code().unwrap_or(-1),
    })
}
