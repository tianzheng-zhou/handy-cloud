use crate::dashscope_omni::{MODEL_FLASH, MODEL_PLUS};
use crate::screen_context::AuthorizeKind;
use crate::settings::{update_settings, ScreenCaptureMethod};
use tauri::AppHandle;

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct CloudAsrModelOption {
    pub id: String,
    pub label: String,
}

#[tauri::command]
#[specta::specta]
pub fn get_cloud_asr_models() -> Vec<CloudAsrModelOption> {
    vec![
        CloudAsrModelOption {
            id: MODEL_FLASH.to_string(),
            label: "Qwen3.5-Omni Flash".to_string(),
        },
        CloudAsrModelOption {
            id: MODEL_PLUS.to_string(),
            label: "Qwen3.5-Omni Plus".to_string(),
        },
    ]
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_asr_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    // `update_settings` holds the write lock across the whole read-modify-write.
    // Doing it as get -> mutate -> write instead leaves a window in which the
    // capture thread's `set_screencast_restore_token` lands and is then clobbered,
    // which is how a granted ScreenCast token turned back into `null` on disk.
    update_settings(&app, |settings| {
        settings.cloud_asr_api_key = api_key;
        // Completing API key setup finishes onboarding for cloud ASR.
        if !settings.cloud_asr_api_key.trim().is_empty() {
            settings.onboarding_completed = true;
        }
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_asr_base_url(app: AppHandle, base_url: String) -> Result<(), String> {
    let trimmed = base_url.trim().to_string();
    update_settings(&app, |settings| {
        settings.cloud_asr_base_url = if trimmed.is_empty() {
            crate::dashscope_omni::DEFAULT_BASE_URL.to_string()
        } else {
            trimmed
        };
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_asr_model(app: AppHandle, model: String) -> Result<(), String> {
    let allowed = [MODEL_FLASH, MODEL_PLUS];
    if !allowed.contains(&model.as_str()) {
        return Err(format!(
            "Unsupported cloud ASR model '{}'. Use {} or {}.",
            model, MODEL_FLASH, MODEL_PLUS
        ));
    }
    update_settings(&app, |settings| {
        settings.cloud_asr_model = model;
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_asr_screen_context(app: AppHandle, enabled: bool) -> Result<(), String> {
    if !enabled {
        crate::screen_context::clear_restore_token(&app)?;
        update_settings(&app, |settings| {
            settings.cloud_asr_screen_context = false;
            Ok(())
        })?;
        return Ok(());
    }

    // Persist first, authorize in the background so the UI stays responsive
    // and the GTK/Wayland main loop can show the portal dialog.
    update_settings(&app, |settings| {
        settings.cloud_asr_screen_context = true;
        Ok(())
    })?;
    crate::screen_context::kickoff_authorize(&app, AuthorizeKind::Enable);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_asr_screen_capture_method(
    app: AppHandle,
    method: String,
) -> Result<(), String> {
    let parsed = match method.as_str() {
        "screenshot" => ScreenCaptureMethod::Screenshot,
        "screencast" => ScreenCaptureMethod::Screencast,
        other => {
            return Err(format!(
                "Unsupported screen capture method '{}'. Use screenshot or screencast.",
                other
            ));
        }
    };

    // Keep any ScreenCast restore token when switching methods — clearing it
    // forced a full re-share after a brief trip to Screenshot, and hotkey
    // capture then fell back to audio-only.
    let screen_context_on = update_settings(&app, |settings| {
        settings.cloud_asr_screen_capture_method = parsed;
        Ok(settings.cloud_asr_screen_context)
    })?;

    if screen_context_on {
        crate::screen_context::kickoff_authorize(&app, AuthorizeKind::MethodChange);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn complete_cloud_asr_onboarding(app: AppHandle) -> Result<(), String> {
    update_settings(&app, |settings| {
        if settings.cloud_asr_api_key.trim().is_empty() {
            return Err("API key is required to complete onboarding".to_string());
        }
        settings.onboarding_completed = true;
        Ok(())
    })
}
