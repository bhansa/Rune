use super::prompts::{system_prompt, user_prompt};
use super::CompanionRequest;
use serde_json::json;

pub async fn call_anthropic(req: &CompanionRequest) -> Result<String, String> {
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
