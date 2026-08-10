use serde::{Deserialize, Serialize};
use serde_json::json;
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
    let entries = fs::read_dir(&path).map_err(|e| format!("read_dir({}): {}", path, e))?;
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

// ---- Companion mode --------------------------------------------------------
#[derive(Deserialize)]
struct CompanionRequest {
    provider: String,               // "anthropic" | "ollama"
    api_key: Option<String>,
    model: String,                  // e.g. "claude-haiku-4-5" or "qwen2.5-coder:7b"
    mode: String,                   // "complete" | "hint"
    language: String,
    before: String,                 // code immediately before cursor
    after: String,                  // code immediately after cursor
    error: Option<String>,          // last console error, optional
}

#[derive(Serialize)]
struct CompanionResponse {
    text: String,
}

fn system_prompt(mode: &str, language: &str) -> String {
    match mode {
        "complete" => format!(
            "You are an inline code completion assistant for {lang}. Continue the code from the cursor. \
Return ONLY the raw code to insert — no explanation, no markdown fences, no comments unless they are \
part of the code being written. Prefer 1 to 3 lines. Match the surrounding indentation exactly.",
            lang = language
        ),
        "hint" => format!(
            "You are a mentor helping a beginner write {lang} code. They are stuck. \
Give one short sentence of natural-language guidance on what to try next. \
Do NOT write code. Do NOT explain existing code. Do NOT summarize. Just the next step, in plain English, under 20 words.",
            lang = language
        ),
        _ => "You are a helpful coding assistant.".into(),
    }
}

fn user_prompt(req: &CompanionRequest) -> String {
    let mut s = String::new();
    s.push_str("CODE BEFORE CURSOR:\n```\n");
    s.push_str(&req.before);
    s.push_str("\n```\n\nCODE AFTER CURSOR:\n```\n");
    s.push_str(&req.after);
    s.push_str("\n```");
    if let Some(err) = &req.error {
        if !err.trim().is_empty() {
            s.push_str("\n\nLAST RUN ERROR:\n");
            s.push_str(err);
        }
    }
    s
}

async fn call_anthropic(req: &CompanionRequest) -> Result<String, String> {
    let key = req
        .api_key
        .as_deref()
        .filter(|k| !k.is_empty())
        .ok_or("Anthropic API key is empty. Add it in Settings.")?;

    let body = json!({
        "model": req.model,
        "max_tokens": if req.mode == "hint" { 80 } else { 200 },
        "system": system_prompt(&req.mode, &req.language),
        "messages": [{ "role": "user", "content": user_prompt(req) }],
    });

    let resp = reqwest::Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    let status = resp.status();
    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Anthropic parse: {}", e))?;

    if !status.is_success() {
        let msg = value["error"]["message"].as_str().unwrap_or("unknown error");
        return Err(format!("Anthropic {}: {}", status.as_u16(), msg));
    }
    Ok(value["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

async fn call_ollama(req: &CompanionRequest) -> Result<String, String> {
    let system = system_prompt(&req.mode, &req.language);
    let prompt = format!("{}\n\n{}", system, user_prompt(req));

    // Reasoning models (deepseek-r1, qwen3-thinking) burn tokens inside
    // <think>…</think> before they get to the answer. Give them room.
    let num_predict = if req.mode == "hint" { 400 } else { 500 };
    let body = json!({
        "model": req.model,
        "prompt": prompt,
        "stream": false,
        "think": false,
        "options": { "num_predict": num_predict },
    });

    let resp = reqwest::Client::new()
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Ollama unreachable at localhost:11434 ({}). Is `ollama serve` running?",
                e
            )
        })?;

    let status = resp.status();
    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Ollama parse: {}", e))?;

    if !status.is_success() {
        let msg = value["error"].as_str().unwrap_or("unknown error");
        return Err(format!("Ollama {}: {}", status.as_u16(), msg));
    }
    Ok(value["response"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
async fn companion_complete(req: CompanionRequest) -> Result<CompanionResponse, String> {
    let raw = match req.provider.as_str() {
        "anthropic" => call_anthropic(&req).await?,
        "ollama" => call_ollama(&req).await?,
        other => return Err(format!("Unknown provider: {}", other)),
    };

    let cleaned = strip_code_fence(strip_think_tags(&raw).trim()).trim().to_string();

    if cleaned.is_empty() {
        // The model responded but produced no usable text after stripping.
        // Common cause: a reasoning model (e.g. deepseek-r1) that used all its
        // tokens thinking. Point the user at a better default.
        if req.provider == "ollama" && req.model.contains("deepseek-r1") {
            return Err("This model is a reasoning model that thinks before answering — for inline suggestions try a coder model instead: `ollama pull qwen2.5-coder:7b`".into());
        }
        return Err("Model returned no usable content.".into());
    }

    Ok(CompanionResponse { text: cleaned })
}

// Some models wrap inline suggestions in ```lang ... ``` even when told not to.
fn strip_code_fence(s: &str) -> String {
    if !s.starts_with("```") {
        return s.to_string();
    }
    let mut lines: Vec<&str> = s.lines().collect();
    lines.remove(0); // opening fence
    if lines.last().map_or(false, |l| l.trim_start().starts_with("```")) {
        lines.pop();
    }
    lines.join("\n")
}

// Reasoning models (deepseek-r1, qwen3-thinking, etc.) emit <think>…</think>
// blocks in their response. Strip them so only the final answer reaches the UI.
fn strip_think_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(start) = rest.find("<think>") {
        out.push_str(&rest[..start]);
        match rest[start..].find("</think>") {
            Some(end) => {
                rest = &rest[start + end + "</think>".len()..];
            }
            None => {
                // Unclosed — the model ran out of tokens mid-thought. Drop the tail.
                rest = "";
                break;
            }
        }
    }
    out.push_str(rest);
    out
}

/// Ping Ollama to fetch its installed models (used to populate the Settings picker).
#[tauri::command]
async fn ollama_list_models() -> Result<Vec<String>, String> {
    let resp = reqwest::Client::new()
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("Ollama not reachable: {}", e))?;
    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse: {}", e))?;
    let names: Vec<String> = value["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    Ok(names)
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
            run_python,
            companion_complete,
            ollama_list_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
