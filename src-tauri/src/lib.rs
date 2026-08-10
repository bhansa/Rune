use serde::Serialize;
use std::fs;
use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Serialize)]
struct PythonResult {
    stdout: String,
    stderr: String,
    code: i32,
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read_file({}): {}", path, e))
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("write_file({}): {}", path, e))
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<String>, String> {
    let entries =
        fs::read_dir(&path).map_err(|e| format!("read_dir({}): {}", path, e))?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
fn exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn run_python(code: String) -> Result<PythonResult, String> {
    // Pipe code via stdin so we don't need a temp file or shell-escaping.
    let mut child = Command::new("python3")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Could not launch python3 ({}). Ensure python3 is installed and on PATH.",
                e
            )
        })?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_dir,
            exists,
            run_python
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
