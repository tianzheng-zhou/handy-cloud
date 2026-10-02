import type { Page } from "@playwright/test";
import type { AppSettings, HistoryEntry } from "../../src/bindings";

export interface MockState {
  settings: AppSettings;
  calls: string[];
  unknown: string[];
  failNext: string | null;
  emit: (event: string, payload: unknown) => void;
}
declare global {
  interface Window {
    __handyMock: MockState;
  }
}

export async function mockTauri(page: Page, onboarding = true) {
  await page.addInitScript(
    ({ onboarding }) => {
      const settings = {
        onboarding_completed: onboarding,
        app_language: "en",
        theme: "system",
        cloud_asr_api_key: onboarding ? "test-only-key" : "",
        cloud_asr_model: "qwen3.5-omni-flash",
        cloud_asr_base_url: "https://example.invalid/v1",
        cloud_asr_screen_context: false,
        cloud_asr_screen_capture_method: "auto",
        push_to_talk: true,
        audio_feedback: false,
        audio_feedback_volume: 0.5,
        selected_microphone: null,
        selected_output_device: null,
        selected_language: "auto",
        keyboard_implementation: "tauri",
        overlay_style: "minimal",
        overlay_position: "bottom",
        history_limit: 100,
        recording_retention_period: "forever",
        custom_words: [],
        post_process_enabled: false,
        debug_mode: false,
        experimental_enabled: false,
        show_whats_new_on_update: false,
        whats_new_last_seen_version: "0.9.4",
        show_tray_icon: true,
        bindings: {
          transcribe: {
            id: "transcribe",
            name: "Transcribe",
            description: "Dictate",
            current_binding: "ctrl+space",
            default_binding: "ctrl+space",
          },
        },
      } satisfies AppSettings;
      let counter = 0;
      const callbacks = new Map<number, (event: unknown) => void>();
      const listeners = new Map<number, { event: string; handler: number }>();
      const emit = (event: string, payload: unknown) => {
        for (const [id, listener] of listeners)
          if (listener.event === event)
            callbacks.get(listener.handler)?.({ event, payload, id });
      };
      const state: MockState = {
        settings,
        calls: [],
        unknown: [],
        failNext: null,
        emit,
      };
      window.__handyMock = state;
      const history: HistoryEntry[] = [
        {
          id: 1,
          file_name: "sample.wav",
          timestamp: 1750000000,
          saved: false,
          title: "Test dictation",
          transcription_text: "你好，Handy Cloud。",
          post_processed_text: null,
          post_process_prompt: null,
          post_process_requested: false,
        },
      ];
      Object.assign(window, {
        __TAURI_OS_PLUGIN_INTERNALS__: {
          platform: "linux",
          os_type: "linux",
          family: "unix",
          arch: "x86_64",
          eol: "\n",
          version: "test",
        },
        __TAURI_EVENT_PLUGIN_INTERNALS__: {
          unregisterListener: (_event: string, id: number) =>
            listeners.delete(id),
        },
        __TAURI_INTERNALS__: {
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { label: "main" },
          },
          transformCallback: (callback: (event: unknown) => void) => {
            const id = ++counter;
            callbacks.set(id, callback);
            return id;
          },
          convertFileSrc: (path: string) => path,
          invoke: async (
            command: string,
            args: Record<string, unknown> = {},
          ) => {
            state.calls.push(command);
            if (state.failNext === command) {
              state.failNext = null;
              throw "Simulated disk full";
            }
            switch (command) {
              case "plugin:event|listen": {
                const id = ++counter;
                listeners.set(id, {
                  event: String(args.event),
                  handler: Number(args.handler),
                });
                return id;
              }
              case "plugin:event|unlisten":
                listeners.delete(Number(args.eventId));
                return;
              case "plugin:event|emit":
                emit(String(args.event), args.payload);
                return;
              case "plugin:app|version":
                return "0.9.4";
              case "plugin:os|locale":
                return "en-US";
              case "get_app_settings":
              case "get_default_settings":
                return structuredClone(settings);
              case "check_custom_sounds":
                return { start: false, stop: false };
              case "get_available_microphones":
              case "get_available_output_devices":
                return [];
              case "get_secure_input_status":
                return {
                  sustained: false,
                  degraded_bindings: [],
                  uncovered_bindings: [],
                  recorder_blocked: false,
                };
              case "get_cloud_asr_models":
                return [
                  { id: "qwen3.8-omni-flash", label: "Qwen3.8-Omni Flash" },
                  { id: "qwen3.5-omni-flash", label: "Qwen3.5-Omni Flash" },
                  { id: "qwen3.5-omni-plus", label: "Qwen3.5-Omni Plus" },
                ];
              case "get_update_capability":
              case "is_laptop":
              case "is_recording":
                return false;
              case "get_app_dir_path":
                return "/test/handy-cloud";
              case "get_log_dir_path":
                return "/test/handy-cloud/logs";
              case "get_history_entries":
                return { entries: history, has_more: false };
              case "get_audio_file_path":
                throw "No audio in browser fixture";
              case "initialize_enigo":
              case "initialize_shortcuts":
              case "show_main_window_command":
                return;
              case "change_cloud_asr_api_key":
                settings.cloud_asr_api_key = String(args.apiKey);
                return;
              case "complete_cloud_asr_onboarding":
                settings.onboarding_completed = true;
                return;
              case "change_cloud_asr_model":
                settings.cloud_asr_model = String(args.model);
                return;
              case "change_app_language_setting":
                settings.app_language = String(args.language);
                return;
              case "change_audio_feedback_setting":
                settings.audio_feedback = Boolean(args.enabled);
                return;
              default:
                state.unknown.push(command);
                throw `Unmocked command: ${command}`;
            }
          },
        },
      });
    },
    { onboarding },
  );
}
