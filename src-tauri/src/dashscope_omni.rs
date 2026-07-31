//! Alibaba Bailian / DashScope Qwen3.5-Omni non-realtime transcription.
//!
//! Uses the OpenAI-compatible chat completions API with `input_audio` and
//! `modalities: ["text"]`. Streaming is required by the Omni API.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use futures_util::StreamExt;
use log::{debug, warn};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::Deserialize;
use serde_json::{json, Value};

pub const DEFAULT_BASE_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1";
pub const MODEL_FLASH: &str = "qwen3.5-omni-flash";
pub const MODEL_PLUS: &str = "qwen3.5-omni-plus";

const TRANSCRIBE_PROMPT: &str =
    "请将这段音频原样转写为文字。只输出转写结果，不要添加解释、标点说明或前后缀。";

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Option<Vec<StreamChoice>>,
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    message: Option<String>,
    code: Option<String>,
}

/// Transcribe a WAV file (bytes) via DashScope Qwen Omni.
pub async fn transcribe_wav(
    api_key: &str,
    base_url: &str,
    model: &str,
    wav_bytes: &[u8],
    language_hint: Option<&str>,
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err(
            "DashScope API key is not configured. Open Settings and add your Bailian API key."
                .to_string(),
        );
    }
    if wav_bytes.is_empty() {
        return Err("Audio is empty".to_string());
    }

    let base = base_url.trim().trim_end_matches('/');
    let url = format!("{}/chat/completions", base);

    let b64 = BASE64.encode(wav_bytes);
    let data_uri = format!("data:audio/wav;base64,{}", b64);

    let mut prompt = TRANSCRIBE_PROMPT.to_string();
    if let Some(lang) = language_hint {
        let lang = lang.trim();
        if !lang.is_empty() && lang != "auto" {
            prompt.push_str(&format!("\n音频语言提示：{}。", lang));
        }
    }

    let body = json!({
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": data_uri,
                        "format": "wav"
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }],
        "modalities": ["text"],
        "stream": true,
        "stream_options": { "include_usage": true },
        "enable_thinking": false,
    });

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
            .map_err(|e| format!("Invalid API key header: {}", e))?,
    );

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    debug!(
        "DashScope Omni transcribe: model={} url={} wav_bytes={}",
        model,
        url,
        wav_bytes.len()
    );

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("DashScope request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let err_body = response.text().await.unwrap_or_default();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(format!(
                "DashScope authentication failed ({}): {}",
                status, err_body
            ));
        }
        return Err(format!("DashScope API error ({}): {}", status, err_body));
    }

    let mut text = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("DashScope stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim_end_matches('\r').to_string();
            buffer = buffer[pos + 1..].to_string();
            if let Some(piece) = parse_sse_line(&line)? {
                text.push_str(&piece);
            }
        }
    }

    // Flush remaining buffer
    if !buffer.trim().is_empty() {
        if let Some(piece) = parse_sse_line(buffer.trim())? {
            text.push_str(&piece);
        }
    }

    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("DashScope returned empty transcription".to_string());
    }
    Ok(text)
}

fn parse_sse_line(line: &str) -> Result<Option<String>, String> {
    let line = line.trim();
    if line.is_empty() || line.starts_with(':') {
        return Ok(None);
    }
    let Some(data) = line.strip_prefix("data:") else {
        return Ok(None);
    };
    let data = data.trim();
    if data.is_empty() || data == "[DONE]" {
        return Ok(None);
    }

    let chunk: StreamChunk = serde_json::from_str(data).map_err(|e| {
        warn!("Failed to parse DashScope SSE chunk: {} ({})", e, data);
        format!("Invalid DashScope stream JSON: {}", e)
    })?;

    if let Some(err) = chunk.error {
        return Err(format!(
            "DashScope stream error: {} ({})",
            err.message.unwrap_or_else(|| "unknown".into()),
            err.code.unwrap_or_else(|| "unknown".into())
        ));
    }

    let content = chunk
        .choices
        .into_iter()
        .flatten()
        .filter_map(|c| c.delta.and_then(|d| d.content))
        .collect::<String>();

    if content.is_empty() {
        // Some chunks only carry usage / role — ignore quietly.
        let _: Result<Value, _> = serde_json::from_str(data);
        Ok(None)
    } else {
        Ok(Some(content))
    }
}

/// Convenience: load WAV from path and transcribe.
pub async fn transcribe_wav_file(
    api_key: &str,
    base_url: &str,
    model: &str,
    wav_path: &std::path::Path,
    language_hint: Option<&str>,
) -> Result<String, String> {
    let bytes = std::fs::read(wav_path)
        .map_err(|e| format!("Failed to read WAV {}: {}", wav_path.display(), e))?;
    transcribe_wav(api_key, base_url, model, &bytes, language_hint).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_done() {
        assert!(parse_sse_line("data: [DONE]").unwrap().is_none());
    }

    #[test]
    fn parse_content() {
        let line = r#"data: {"choices":[{"delta":{"content":"你好"}}]}"#;
        assert_eq!(parse_sse_line(line).unwrap().as_deref(), Some("你好"));
    }
}
