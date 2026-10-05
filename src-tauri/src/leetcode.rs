// LeetCode problem fetcher — pulls problem JSON from the public
// `neenza/leetcode-problems` repo and caches each file to
// `<app_data>/leetcode/<slug>.json` so a second click is instant and works
// offline.
//
// Only exposed if the user opts in via Settings; the toolbar button is
// hidden by default. Fetches are user-triggered and one-at-a-time — this is
// not a scraper.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Resolve <app_data_dir>/leetcode/, creating it lazily.
fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    let dir = base.join("leetcode");
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all({}): {}", dir.display(), e))?;
    Ok(dir)
}

fn cache_path(app: &tauri::AppHandle, slug: &str) -> Result<PathBuf, String> {
    // slug is a URL-safe kebab from the repo — but sanitise it anyway so we
    // can never be tricked into writing outside our directory.
    if slug.contains('/') || slug.contains("..") || slug.is_empty() {
        return Err(format!("invalid slug: {}", slug));
    }
    Ok(cache_dir(app)?.join(format!("{}.json", slug)))
}

/// Fetch a problem's full JSON (description, examples, hints, code_snippets…)
/// from the public dataset. `numeric_id` is the LeetCode frontend id used to
/// build the file name (e.g. `1` → `0001-two-sum.json`).
#[tauri::command]
pub async fn leetcode_get(
    app: tauri::AppHandle,
    slug: String,
    numeric_id: u32,
) -> Result<Value, String> {
    let cache = cache_path(&app, &slug)?;

    // Try cache first.
    if let Ok(bytes) = fs::read(&cache) {
        if let Ok(json) = serde_json::from_slice::<Value>(&bytes) {
            return Ok(json);
        }
    }

    let file_name = format!("{:04}-{}.json", numeric_id, slug);
    let url = format!(
        "https://raw.githubusercontent.com/neenza/leetcode-problems/master/problems/{}",
        file_name
    );

    let resp = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", "Rune")
        .send()
        .await
        .map_err(|e| format!("fetch {}: {}", url, e))?;

    if !resp.status().is_success() {
        return Err(format!("{}: HTTP {}", url, resp.status().as_u16()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("read body: {}", e))?;
    let json: Value = serde_json::from_slice(&bytes)
        .map_err(|e| format!("parse problem JSON: {}", e))?;

    // Best-effort cache — a write failure shouldn't fail the request.
    let _ = fs::write(&cache, &bytes);

    Ok(json)
}

/// Clear all cached problems on disk (used by settings → "Clear cache").
#[tauri::command]
pub fn leetcode_clear_cache(app: tauri::AppHandle) -> Result<u32, String> {
    let dir = cache_dir(&app)?;
    let mut count = 0;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
            fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    Ok(count)
}
