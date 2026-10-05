use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;

/// Resolve a CLI binary by name. `.app` launches from Finder inherit only the
/// minimal launchd PATH (no `/opt/homebrew/bin`, no `~/.local/bin`), so tools
/// installed by Homebrew or the user's dotfiles are invisible unless we look
/// them up. Strategy: check common install locations first (fast, no fork),
/// then fall back to asking the user's login shell where the binary lives.
/// Result is cached per binary name so subsequent calls are free.
pub fn resolve_binary(name: &str) -> Option<PathBuf> {
    let common = [
        "/opt/homebrew/bin",  // Apple Silicon Homebrew
        "/usr/local/bin",     // Intel Homebrew / manual installs
        "/usr/bin",           // system
        "/bin",
    ];
    for dir in &common {
        let p = PathBuf::from(dir).join(name);
        if p.exists() { return Some(p); }
    }
    if let Ok(home) = std::env::var("HOME") {
        for suffix in &[".local/bin", ".cargo/bin", "bin"] {
            let p = PathBuf::from(&home).join(suffix).join(name);
            if p.exists() { return Some(p); }
        }
    }
    // Last resort — spawn a login shell so the user's shell rc file is sourced,
    // then ask it for the binary. Slower (~50–100ms) but reliable.
    let out = Command::new("/bin/zsh")
        .arg("-lc")
        .arg(format!("command -v {}", name))
        .output()
        .ok()?;
    if !out.status.success() { return None; }
    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if path.is_empty() { return None; }
    Some(PathBuf::from(path))
}

pub fn claude_path() -> Option<&'static PathBuf> {
    static P: OnceLock<Option<PathBuf>> = OnceLock::new();
    P.get_or_init(|| resolve_binary("claude")).as_ref()
}

pub fn python3_path() -> Option<&'static PathBuf> {
    static P: OnceLock<Option<PathBuf>> = OnceLock::new();
    P.get_or_init(|| resolve_binary("python3")).as_ref()
}
