use super::prompts::{system_prompt, user_prompt};
use super::CompanionRequest;
use crate::bin_resolver::claude_path;

pub async fn call_claude_cli(req: &CompanionRequest) -> Result<String, String> {
    let system = system_prompt(&req.mode, &req.language);
    let user = user_prompt(req);
    let bin = claude_path().ok_or(
        "Could not find `claude` on your system. Install Claude Code from claude.ai/code and run `claude login`.".to_string()
    )?;
    // Claude CLI's `-p "..."` takes the user prompt; system goes via a flag.
    let output = std::process::Command::new(bin)
        .arg("-p")
        .arg(&user)
        .arg("--model")
        .arg(&req.model)
        .arg("--append-system-prompt")
        .arg(&system)
        .output()
        .map_err(|e| format!("`claude` failed to start: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("claude CLI failed: {}", stderr.trim()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Detect whether the user's Claude Code CLI is installed and callable.
/// Runs `claude --version` and returns the version string on success.
#[tauri::command]
pub fn claude_cli_probe() -> Result<String, String> {
    let bin = claude_path().ok_or(
        "`claude` not installed or not on PATH. Install Claude Code from claude.ai/code.".to_string()
    )?;
    let output = std::process::Command::new(bin)
        .arg("--version")
        .output()
        .map_err(|e| format!("`claude` failed to start: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
