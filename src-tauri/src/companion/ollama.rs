use super::prompts::{system_prompt, user_prompt};
use super::CompanionRequest;
use serde_json::json;

pub async fn call_ollama(req: &CompanionRequest) -> Result<String, String> {
    let system = system_prompt(&req.mode, &req.language);
    let prompt = format!("{}\n\n{}", system, user_prompt(req));

    // Reasoning models (deepseek-r1, qwen3-thinking) burn most of their budget
    // inside <think>…</think>. Testing shows deepseek-r1:1.5b needs ~1000
    // tokens of headroom before its answer starts, so we set generous limits.
    // num_predict is an upper bound — the model stops early on EOS, so a big
    // number doesn't slow down non-reasoning coder models.
    let is_reasoning = req.model.contains("r1") || req.model.contains("thinking") || req.model.contains("qwq");
    let num_predict = if is_reasoning {
        // The richer system prompt in this version eats budget, so keep the
        // ceiling generous. num_predict is an upper bound; coder models still
        // stop early on EOS.
        if req.mode == "hint" { 2000 } else { 2000 }
    } else {
        if req.mode == "hint" { 200 } else { 300 }
    };
    let body = json!({
        "model": req.model,
        "prompt": prompt,
        "stream": false,
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

    // Ollama's newer API splits reasoning-model output into two fields:
    //   response — the final answer (may be empty if the model ran out of tokens while thinking)
    //   thinking — the internal chain-of-thought
    // If `response` is empty but `thinking` has content, fall back to the
    // tail of thinking as a best-effort answer.
    let response = value["response"].as_str().unwrap_or("").trim().to_string();
    let thinking = value["thinking"].as_str().unwrap_or("").trim().to_string();
    let done_reason = value["done_reason"].as_str().unwrap_or("").to_string();

    if !response.is_empty() {
        return Ok(response);
    }
    if !thinking.is_empty() {
        // Last non-empty paragraph of the thinking usually holds the
        // model's provisional answer.
        let tail = thinking
            .rsplit("\n\n")
            .find(|p| !p.trim().is_empty())
            .unwrap_or(&thinking);
        return Ok(tail.to_string());
    }
    if done_reason == "length" {
        return Err("Model hit its token budget before answering. Try a smaller/simpler prompt or a code-tuned model like qwen2.5-coder:3b.".into());
    }
    Err(format!("Ollama returned no content (done={done_reason})"))
}

/// Ping Ollama to fetch its installed models (used to populate the Settings picker).
#[tauri::command]
pub async fn ollama_list_models() -> Result<Vec<String>, String> {
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
