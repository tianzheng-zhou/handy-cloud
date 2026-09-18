//! Updates are available only in builds configured with our own signed feed.

/// Return whether this build includes a signed update source.
#[tauri::command]
#[specta::specta]
pub fn get_update_capability(app: tauri::AppHandle) -> bool {
    configured(app.config().plugins.0.get("updater"))
}

fn configured(config: Option<&serde_json::Value>) -> bool {
    config.is_some_and(|config| {
        let key = config.get("pubkey").and_then(|v| v.as_str()).unwrap_or("");
        let endpoints = config.get("endpoints").and_then(|v| v.as_array());
        !key.trim().is_empty()
            && endpoints.is_some_and(|urls| {
                !urls.is_empty()
                    && urls.iter().all(|url| {
                        url.as_str().is_some_and(|url| {
                            url.starts_with("https://")
                                && !url.to_lowercase().contains("github.com/cjpais/handy/")
                        })
                    })
            })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn requires_own_signed_feed() {
        assert!(!configured(None));
        assert!(!configured(Some(
            &json!({"pubkey":"", "endpoints":["https://updates.example.com"]})
        )));
        assert!(!configured(Some(
            &json!({"pubkey":"key", "endpoints":["https://github.com/cjpais/Handy/releases/latest/download/latest.json"]})
        )));
        assert!(configured(Some(
            &json!({"pubkey":"key", "endpoints":["https://updates.example.com"]})
        )));
    }
}
