use crate::dashscope_omni::{MODEL_FLASH, MODEL_PLUS};
use crate::settings::{get_settings, write_settings};
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
    let mut settings = get_settings(&app);
    settings.cloud_asr_api_key = api_key;
    // Completing API key setup finishes onboarding for cloud ASR.
    if !settings.cloud_asr_api_key.trim().is_empty() {
        settings.onboarding_completed = true;
    }
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_asr_base_url(app: AppHandle, base_url: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    let trimmed = base_url.trim().to_string();
    settings.cloud_asr_base_url = if trimmed.is_empty() {
        crate::dashscope_omni::DEFAULT_BASE_URL.to_string()
    } else {
        trimmed
    };
    write_settings(&app, settings);
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
    let mut settings = get_settings(&app);
    settings.cloud_asr_model = model;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn complete_cloud_asr_onboarding(app: AppHandle) -> Result<(), String> {
    let mut settings = get_settings(&app);
    if settings.cloud_asr_api_key.trim().is_empty() {
        return Err("API key is required to complete onboarding".to_string());
    }
    settings.onboarding_completed = true;
    write_settings(&app, settings);
    Ok(())
}
