use serde::{Deserialize, Serialize};

pub mod anthropic;
pub mod claude_cli;
pub mod ollama;
pub mod prompts;

use anthropic::call_anthropic;
use claude_cli::call_claude_cli;
use ollama::call_ollama;

#[derive(Deserialize)]
pub struct CompanionRequest {
    pub provider: String,               // "anthropic" | "claude-cli" | "ollama"
    pub api_key: Option<String>,
    pub model: String,                  // e.g. "claude-haiku-4-5" or "qwen2.5-coder:7b"
    pub mode: String,                   // "complete" | "hint"
    pub language: String,
    pub before: String,                 // code immediately before cursor
    pub after: String,                  // code immediately after cursor
    pub error: Option<String>,          // last console error, optional
    #[serde(default)]
    pub prev_hints: Vec<String>,        // previously-issued suggestions in this session
}

#[derive(Serialize)]
pub struct CompanionResponse {
    text: String,
}

#[tauri::command]
pub async fn companion_complete(req: CompanionRequest) -> Result<CompanionResponse, String> {
    let raw = match req.provider.as_str() {
        "anthropic" => call_anthropic(&req).await?,
        "ollama" => call_ollama(&req).await?,
        "claude-cli" => call_claude_cli(&req).await?,
        other => return Err(format!("Unknown provider: {}", other)),
    };

    let stripped = strip_code_fence(strip_think_tags(&raw).trim()).trim().to_string();
    let cleaned = if req.mode == "complete" {
        shape_completion(&stripped)
    } else {
        // Hint mode — first non-empty line, single sentence. Some models emit
        // a blank line after </think>, so use .find() rather than .next().
        stripped
            .lines()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("")
            .trim()
            .to_string()
    };

    if cleaned.is_empty() {
        // Distinguish the two failure modes so the message is actually useful.
        let had_open_think = raw.contains("<think>");
        let closed_think = raw.contains("</think>");
        if had_open_think && !closed_think {
            return Err(format!(
                "Model ran out of tokens while thinking (raw {} chars, no </think>). For reasoning models try a smaller/simpler prompt or a coder model like qwen2.5-coder.",
                raw.len()
            ));
        }
        if raw.trim().is_empty() {
            return Err("Model returned an empty response.".into());
        }
        return Err(format!("Model produced no text after stripping (raw {} chars).", raw.len()));
    }

    Ok(CompanionResponse { text: cleaned })
}

// Some models wrap inline suggestions in ```lang ... ``` even when told not to.
// This also handles the messier case where the response is a full markdown
// explanation with a code fence embedded in the middle — in that case we
// extract only the code inside the first fence.
fn strip_code_fence(s: &str) -> String {
    // If the response contains ``` anywhere, pull out the first fenced block.
    if let Some(open) = s.find("```") {
        // Skip the opening fence line (which may be "```javascript" or just "```").
        let after_open = &s[open + 3..];
        let line_end = after_open.find('\n').unwrap_or(after_open.len());
        let body_start = after_open.get(line_end..).unwrap_or("").trim_start_matches('\n');
        if let Some(close_rel) = body_start.find("```") {
            return body_start[..close_rel].trim_end_matches('\n').to_string();
        }
        // No closing fence — return everything after the opening line.
        return body_start.trim_end_matches('\n').to_string();
    }
    s.to_string()
}

/// For "complete" mode, keep suggestions short and code-shaped. Drops leading
/// prose, caps at a handful of lines, and stops at obvious markdown structure.
fn shape_completion(s: &str) -> String {
    let mut out_lines: Vec<&str> = Vec::new();
    let mut in_code_yet = false;
    for line in s.lines() {
        let trimmed = line.trim_start();
        // Stop when we hit obvious markdown structure (headings, list bullets that
        // start with plain words rather than code, or a second fenced block).
        if trimmed.starts_with("###") || trimmed.starts_with("```") {
            break;
        }
        // Skip empty leading lines but preserve them once code has started.
        if trimmed.is_empty() {
            if !in_code_yet { continue; }
            out_lines.push(line);
            continue;
        }
        in_code_yet = true;
        out_lines.push(line);
        if out_lines.len() >= 5 { break; }
    }
    out_lines.join("\n").trim_end().to_string()
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
