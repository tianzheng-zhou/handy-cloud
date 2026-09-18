//! Incremental SSE decoding. Network chunks are bytes, not UTF-8 boundaries.

use serde::Deserialize;

#[derive(Default)]
pub(super) struct Decoder {
    pending: Vec<u8>,
    event: String,
    text: String,
    done: bool,
    finished: bool,
}

#[derive(Deserialize)]
struct Chunk {
    choices: Option<Vec<Choice>>,
    error: Option<ApiError>,
}

#[derive(Deserialize)]
struct Choice {
    delta: Option<Delta>,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
}

#[derive(Deserialize)]
struct ApiError {
    message: Option<String>,
    code: Option<String>,
}

impl Decoder {
    /// Returns true after the explicit end marker; the caller can close the HTTP body.
    pub fn push(&mut self, bytes: &[u8]) -> Result<bool, String> {
        if self.done {
            return Ok(true);
        }
        self.pending.extend_from_slice(bytes);
        let mut consumed = 0;
        while let Some(end) = self.pending[consumed..].iter().position(|b| *b == b'\n') {
            let end = consumed + end;
            let line = std::str::from_utf8(&self.pending[consumed..end])
                .map_err(|_| "Invalid UTF-8 in DashScope stream".to_string())?
                .trim_end_matches('\r')
                .to_owned();
            self.line(&line)?;
            consumed = end + 1;
            if self.done {
                break;
            }
        }
        self.pending.drain(..consumed);
        if self.pending.len() + self.event.len() > 1024 * 1024 {
            return Err("DashScope stream event exceeds 1 MiB".to_string());
        }
        Ok(self.done)
    }

    fn line(&mut self, line: &str) -> Result<(), String> {
        if line.is_empty() {
            return self.dispatch();
        }
        if let Some(data) = line.strip_prefix("data:") {
            if self.event.len() + data.len() + 1 > 1024 * 1024 {
                return Err("DashScope stream event exceeds 1 MiB".to_string());
            }
            if !self.event.is_empty() {
                self.event.push('\n');
            }
            self.event.push_str(data.strip_prefix(' ').unwrap_or(data));
        }
        Ok(())
    }

    fn dispatch(&mut self) -> Result<(), String> {
        let event = std::mem::take(&mut self.event);
        let data = event.trim();
        if data.is_empty() {
            return Ok(());
        }
        if data == "[DONE]" {
            self.done = true;
            return Ok(());
        }
        // Do not log raw event contents: they may contain private transcription text.
        let chunk: Chunk = serde_json::from_str(data)
            .map_err(|error| format!("Invalid DashScope stream JSON: {error}"))?;
        if let Some(error) = chunk.error {
            return Err(format!(
                "DashScope stream error: {} ({})",
                error.message.unwrap_or_else(|| "unknown".into()),
                error.code.unwrap_or_else(|| "unknown".into())
            ));
        }
        for choice in chunk.choices.into_iter().flatten() {
            if let Some(content) = choice.delta.and_then(|delta| delta.content) {
                self.text.push_str(&content);
            }
            if let Some(reason) = choice.finish_reason {
                if reason != "stop" {
                    return Err(format!(
                        "DashScope transcription ended before completion: {reason}"
                    ));
                }
                self.finished = true;
            }
        }
        Ok(())
    }

    pub fn finish(mut self) -> Result<String, String> {
        if !self.done {
            if !self.pending.is_empty() {
                let pending = std::mem::take(&mut self.pending);
                let line = std::str::from_utf8(&pending)
                    .map_err(|_| "Truncated UTF-8 in DashScope stream".to_string())?;
                self.line(line.trim_end_matches('\r'))?;
            }
            self.dispatch()?;
        }
        if !self.done && !self.finished {
            return Err("DashScope stream ended without a completion marker".to_string());
        }
        let text = self.text.trim().to_string();
        if text.is_empty() {
            return Err("DashScope returned empty transcription".to_string());
        }
        Ok(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RESPONSE: &str = ": keepalive\r\ndata: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\r\n\r\ndata: {\"choices\":[{\"delta\":{\"content\":\"你好🌍\"}}]}\r\n\r\ndata: {\"usage\":{}}\r\n\r\ndata: [DONE]\r\n\r\n";

    #[test]
    fn decodes_at_every_byte_boundary_including_multibyte_characters() {
        for split in 0..RESPONSE.len() {
            let mut decoder = Decoder::default();
            decoder.push(&RESPONSE.as_bytes()[..split]).unwrap();
            decoder.push(&RESPONSE.as_bytes()[split..]).unwrap();
            assert_eq!(decoder.finish().unwrap(), "你好🌍");
        }
        let mut decoder = Decoder::default();
        for byte in RESPONSE.as_bytes() {
            decoder.push(&[*byte]).unwrap();
        }
        assert_eq!(decoder.finish().unwrap(), "你好🌍");
    }

    #[test]
    fn handles_multiline_data_and_finish_reason_without_done() {
        let mut decoder = Decoder::default();
        decoder.push(b"data: {\"choices\":\n data: ignored\ndata: [{\"delta\":{\"content\":\"hello\"},\"finish_reason\":\"stop\"}]}\n\n").unwrap();
        assert_eq!(decoder.finish().unwrap(), "hello");
    }

    #[test]
    fn rejects_truncation_invalid_data_errors_and_length_limits() {
        for data in [
            "data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n",
            "data: {broken}\n\n",
            "data: {\"error\":{\"code\":\"quota\",\"message\":\"over limit\"}}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"length\"}]}\n\n",
            "data: [DONE]\n\n",
        ] {
            let mut decoder = Decoder::default();
            assert!(decoder
                .push(data.as_bytes())
                .and_then(|_| decoder.finish())
                .is_err());
        }
        assert!(Decoder::default()
            .push(&vec![b'x'; 1024 * 1024 + 1])
            .is_err());
        let complete_oversized_event = format!("data: {}\n\n", "x".repeat(1024 * 1024 + 1));
        assert!(Decoder::default()
            .push(complete_oversized_event.as_bytes())
            .is_err());
    }
}
