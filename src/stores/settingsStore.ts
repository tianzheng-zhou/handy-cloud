import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { AppSettings as Settings, AudioDevice } from "@/bindings";
import { commands } from "@/bindings";

interface SettingsStore {
  lastError: { message: string } | null;
  settings: Settings | null;
  defaultSettings: Settings | null;
  isLoading: boolean;
  isUpdating: Record<string, boolean>;
  audioDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  customSounds: { start: boolean; stop: boolean };
  postProcessModelOptions: Record<string, string[]>;

  // Actions
  initialize: () => Promise<void>;
  loadDefaultSettings: () => Promise<void>;
  updateSetting: <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => Promise<void>;
  resetSetting: (key: keyof Settings) => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshAudioDevices: () => Promise<void>;
  refreshOutputDevices: () => Promise<void>;
  updateBinding: (id: string, binding: string) => Promise<void>;
  resetBinding: (id: string) => Promise<void>;
  getSetting: <K extends keyof Settings>(key: K) => Settings[K] | undefined;
  isUpdatingKey: (key: string) => boolean;
  playTestSound: (soundType: "start" | "stop") => Promise<void>;
  checkCustomSounds: () => Promise<void>;
  setPostProcessProvider: (providerId: string) => Promise<void>;
  updatePostProcessSetting: (
    settingType: "base_url" | "api_key" | "model",
    providerId: string,
    value: string,
  ) => Promise<void>;
  updatePostProcessBaseUrl: (
    providerId: string,
    baseUrl: string,
  ) => Promise<void>;
  updatePostProcessApiKey: (
    providerId: string,
    apiKey: string,
  ) => Promise<void>;
  updatePostProcessModel: (providerId: string, model: string) => Promise<void>;
  fetchPostProcessModels: (providerId: string) => Promise<string[]>;
  updateCloudAsrApiKey: (apiKey: string) => Promise<void>;
  updateCloudAsrBaseUrl: (baseUrl: string) => Promise<void>;
  updateCloudAsrModel: (model: string) => Promise<void>;
  updateCloudAsrScreenContext: (enabled: boolean) => Promise<void>;
  setPostProcessModelOptions: (providerId: string, models: string[]) => void;

  // Internal state setters
  setSettings: (settings: Settings | null) => void;
  setDefaultSettings: (defaultSettings: Settings | null) => void;
  setLoading: (loading: boolean) => void;
  setUpdating: (key: string, updating: boolean) => void;
  setAudioDevices: (devices: AudioDevice[]) => void;
  setOutputDevices: (devices: AudioDevice[]) => void;
  setCustomSounds: (sounds: { start: boolean; stop: boolean }) => void;
}

// Note: Default settings are now fetched from Rust via commands.getDefaultSettings()
// This ensures platform-specific defaults (like overlay_position, shortcuts, paste_method) work correctly

const DEFAULT_AUDIO_DEVICE: AudioDevice = {
  index: "default",
  name: "Default",
  is_default: true,
};

const settingUpdaters: {
  [K in keyof Settings]?: (value: Settings[K]) => Promise<unknown>;
} = {
  cloud_asr_api_key: (value) => commands.changeCloudAsrApiKey(value as string),
  cloud_asr_base_url: (value) =>
    commands.changeCloudAsrBaseUrl(value as string),
  cloud_asr_model: (value) => commands.changeCloudAsrModel(value as string),
  cloud_asr_screen_context: async (value) => {
    const result = await commands.changeCloudAsrScreenContext(value as boolean);
    if (result.status === "error") {
      throw new Error(String(result.error));
    }
  },
  cloud_asr_screen_capture_method: async (value) => {
    const result = await commands.changeCloudAsrScreenCaptureMethod(
      value as string,
    );
    if (result.status === "error") {
      throw new Error(String(result.error));
    }
  },
  always_on_microphone: (value) =>
    commands.updateMicrophoneMode(value as boolean),
  audio_feedback: (value) =>
    commands.changeAudioFeedbackSetting(value as boolean),
  audio_feedback_volume: (value) =>
    commands.changeAudioFeedbackVolumeSetting(value as number),
  sound_theme: (value) => commands.changeSoundThemeSetting(value as string),
  start_hidden: (value) => commands.changeStartHiddenSetting(value as boolean),
  autostart_enabled: (value) =>
    commands.changeAutostartSetting(value as boolean),
  update_checks_enabled: (value) =>
    commands.changeUpdateChecksSetting(value as boolean),
  show_whats_new_on_update: (value) =>
    commands.changeShowWhatsNewOnUpdateSetting(value as boolean),
  whats_new_last_seen_version: (value) =>
    commands.changeWhatsNewLastSeenVersionSetting(value as string),
  push_to_talk: (value) => commands.changePttSetting(value as boolean),
  selected_microphone: (value) =>
    commands.setSelectedMicrophone(
      (value as string) === "Default" || value === null
        ? "default"
        : (value as string),
    ),
  clamshell_microphone: (value) =>
    commands.setClamshellMicrophone(
      (value as string) === "Default" ? "default" : (value as string),
    ),
  selected_output_device: (value) =>
    commands.setSelectedOutputDevice(
      (value as string) === "Default" || value === null
        ? "default"
        : (value as string),
    ),
  recording_retention_period: (value) =>
    commands.updateRecordingRetentionPeriod(value as string),
  translate_to_english: (value) =>
    commands.changeTranslateToEnglishSetting(value as boolean),
  selected_language: (value) =>
    commands.changeSelectedLanguageSetting(value as string),
  overlay_position: (value) =>
    commands.changeOverlayPositionSetting(value as string),
  debug_mode: (value) => commands.changeDebugModeSetting(value as boolean),
  custom_words: (value) => commands.updateCustomWords(value as string[]),
  word_correction_threshold: (value) =>
    commands.changeWordCorrectionThresholdSetting(value as number),
  paste_delay_ms: (value) =>
    commands.changePasteDelayMsSetting(value as number),
  paste_delay_after_ms: (value) =>
    commands.changePasteDelayAfterMsSetting(value as number),
  reliable_paste: (value) =>
    commands.changeReliablePasteSetting(value as boolean),
  paste_method: (value) => commands.changePasteMethodSetting(value as string),
  typing_tool: (value) => commands.changeTypingToolSetting(value as string),
  external_script_path: (value) =>
    commands.changeExternalScriptPathSetting(value as string | null),
  clipboard_handling: (value) =>
    commands.changeClipboardHandlingSetting(value as string),
  auto_submit: (value) => commands.changeAutoSubmitSetting(value as boolean),
  auto_submit_key: (value) =>
    commands.changeAutoSubmitKeySetting(value as string),
  history_limit: (value) => commands.updateHistoryLimit(value as number),
  post_process_enabled: (value) =>
    commands.changePostProcessEnabledSetting(value as boolean),
  post_process_selected_prompt_id: (value) =>
    commands.setPostProcessSelectedPrompt(value as string),
  mute_while_recording: (value) =>
    commands.changeMuteWhileRecordingSetting(value as boolean),
  append_trailing_space: (value) =>
    commands.changeAppendTrailingSpaceSetting(value as boolean),
  log_level: (value) =>
    commands.setLogLevel(value as NonNullable<Settings["log_level"]>),
  app_language: (value) => commands.changeAppLanguageSetting(value as string),
  theme: (value) => commands.changeThemeSetting(value as string),
  experimental_enabled: (value) =>
    commands.changeExperimentalEnabledSetting(value as boolean),
  lazy_stream_close: (value) =>
    commands.changeLazyStreamCloseSetting(value as boolean),
  overlay_style: (value) => commands.changeOverlayStyleSetting(value as string),
  vad_enabled: (value) => commands.changeVadEnabledSetting(value as boolean),
  show_tray_icon: (value) =>
    commands.changeShowTrayIconSetting(value as boolean),
  extra_recording_buffer_ms: (value) =>
    commands.changeExtraRecordingBufferSetting(value as number),
};

/** Unwrap commands consistently: generated bindings resolve even when Rust returns Err. */
export function unwrap<T>(
  result: { status: "ok"; data: T } | { status: "error"; error: unknown },
): T {
  if (result.status === "error") throw new Error(String(result.error));
  return result.data;
}

export const createSettingsStore = () => {
  let initialization: Promise<void> | undefined;
  const queues = new Map<string, Promise<void>>();
  const revisions = new Map<string, number>();
  return create<SettingsStore>()(
    subscribeWithSelector((set, get) => {
      const report = (error: unknown) =>
        set({ lastError: { message: String(error) } });
      // Attach a rejection handler for fire-and-forget controls while preserving the
      // original rejected promise for callers that need to stop a sequence on failure.
      const run = (key: string, task: () => Promise<void>) => {
        get().setUpdating(key, true);
        revisions.set(key, (revisions.get(key) ?? 0) + 1);
        const pending = (queues.get(key) ?? Promise.resolve())
          .catch(() => {})
          .then(task);
        queues.set(key, pending);
        void pending.catch(report).finally(() => {
          if (queues.get(key) === pending) {
            queues.delete(key);
            get().setUpdating(key, false);
          }
        });
        return pending;
      };
      const mergeFields = (settings: Settings, fields: (keyof Settings)[]) => {
        set((state) => {
          if (!state.settings) return { settings };
          const merged = { ...state.settings };
          for (const field of fields)
            Object.assign(merged, { [field]: settings[field] });
          return { settings: merged };
        });
      };
      const updateFields = (
        key: string,
        fields: (keyof Settings)[],
        command: () => Promise<unknown>,
      ) =>
        run(key, async () => {
          checkResult(await command());
          mergeFields(unwrap(await commands.getAppSettings()), fields);
        });
      return {
        settings: null,
        defaultSettings: null,
        isLoading: true,
        isUpdating: {},
        lastError: null,
        audioDevices: [],
        outputDevices: [],
        customSounds: { start: false, stop: false },
        postProcessModelOptions: {},
        setSettings: (settings) => set({ settings }),
        setDefaultSettings: (defaultSettings) => set({ defaultSettings }),
        setLoading: (isLoading) => set({ isLoading }),
        setUpdating: (key, value) =>
          set((state) => ({
            isUpdating: { ...state.isUpdating, [key]: value },
          })),
        setAudioDevices: (audioDevices) => set({ audioDevices }),
        setOutputDevices: (outputDevices) => set({ outputDevices }),
        setCustomSounds: (customSounds) => set({ customSounds }),
        getSetting: (key) => get().settings?.[key],
        isUpdatingKey: (key) => !!get().isUpdating[key],
        refreshSettings: async () => {
          const before = new Map(revisions);
          try {
            const settings = unwrap(await commands.getAppSettings());
            const fields = (Object.keys(settings) as (keyof Settings)[]).filter(
              (key) =>
                !queues.has(key) &&
                before.get(key) === revisions.get(key) &&
                !(
                  key.startsWith("post_process_") && queues.has("post_process")
                ),
            );
            mergeFields(settings, fields);
          } catch (error) {
            report(error);
          } finally {
            set({ isLoading: false });
          }
        },
        loadDefaultSettings: async () => {
          try {
            set({
              defaultSettings: unwrap(await commands.getDefaultSettings()),
            });
          } catch (error) {
            report(error);
          }
        },
        initialize: () => {
          initialization ??= Promise.all([
            get().loadDefaultSettings(),
            get().refreshSettings(),
            get().checkCustomSounds(),
          ]).then(() => {});
          return initialization;
        },
        refreshAudioDevices: async () => {
          try {
            set({
              audioDevices: [
                DEFAULT_AUDIO_DEVICE,
                ...unwrap(await commands.getAvailableMicrophones()).filter(
                  (d) => !["Default", "default"].includes(d.name),
                ),
              ],
            });
          } catch {
            set({ audioDevices: [DEFAULT_AUDIO_DEVICE] });
          }
        },
        refreshOutputDevices: async () => {
          try {
            set({
              outputDevices: [
                DEFAULT_AUDIO_DEVICE,
                ...unwrap(await commands.getAvailableOutputDevices()).filter(
                  (d) => !["Default", "default"].includes(d.name),
                ),
              ],
            });
          } catch {
            set({ outputDevices: [DEFAULT_AUDIO_DEVICE] });
          }
        },
        checkCustomSounds: async () => {
          try {
            set({ customSounds: await commands.checkCustomSounds() });
          } catch (error) {
            report(error);
          }
        },
        playTestSound: (sound) =>
          run("test_sound", async () => {
            checkResult(await commands.playTestSound(sound));
          }),
        updateSetting: (key, value) =>
          run(key, async () => {
            const previous = get().settings?.[key];
            const updater = settingUpdaters[key];
            if (!updater) throw new Error(`Unsupported setting: ${key}`);
            set((state) => ({
              settings: state.settings
                ? { ...state.settings, [key]: value }
                : null,
            }));
            try {
              checkResult(await updater(value));
            } catch (error) {
              // Only restore this field; concurrent successful writes must survive.
              set((state) => ({
                settings: state.settings
                  ? { ...state.settings, [key]: previous }
                  : null,
              }));
              throw error;
            }
          }),
        resetSetting: (key) => {
          const defaults = get().defaultSettings;
          return defaults
            ? get().updateSetting(key, defaults[key])
            : Promise.resolve();
        },
        updateBinding: (id, binding) =>
          updateFields("bindings", ["bindings"], async () => {
            const result = unwrap(await commands.changeBinding(id, binding));
            if (!result.success)
              throw new Error(result.error ?? "Failed to update binding");
          }),
        resetBinding: (id) =>
          updateFields("bindings", ["bindings"], () =>
            commands.resetBinding(id),
          ),
        setPostProcessProvider: (providerId) =>
          updateFields("post_process", ["post_process_provider_id"], () =>
            commands.setPostProcessProvider(providerId),
          ),
        updatePostProcessSetting: (type, providerId, value) =>
          updateFields(
            "post_process",
            [
              "post_process_providers",
              "post_process_api_keys",
              "post_process_models",
            ],
            async () => {
              const result =
                type === "base_url"
                  ? await commands.changePostProcessBaseUrlSetting(
                      providerId,
                      value,
                    )
                  : type === "api_key"
                    ? await commands.changePostProcessApiKeySetting(
                        providerId,
                        value,
                      )
                    : await commands.changePostProcessModelSetting(
                        providerId,
                        value,
                      );
              checkResult(result);
              if (type !== "model")
                get().setPostProcessModelOptions(providerId, []);
            },
          ),
        updatePostProcessBaseUrl: (id, value) =>
          get().updatePostProcessSetting("base_url", id, value),
        updatePostProcessApiKey: (id, value) =>
          get().updatePostProcessSetting("api_key", id, value),
        updatePostProcessModel: (id, value) =>
          get().updatePostProcessSetting("model", id, value),
        fetchPostProcessModels: async (providerId) => {
          const key = `post_process_models_fetch:${providerId}`;
          get().setUpdating(key, true);
          try {
            const models = unwrap(
              await commands.fetchPostProcessModels(providerId),
            );
            get().setPostProcessModelOptions(providerId, models);
            return models;
          } catch (error) {
            report(error);
            return [];
          } finally {
            get().setUpdating(key, false);
          }
        },
        setPostProcessModelOptions: (id, models) =>
          set((state) => ({
            postProcessModelOptions: {
              ...state.postProcessModelOptions,
              [id]: models,
            },
          })),
        updateCloudAsrApiKey: (value) =>
          get().updateSetting("cloud_asr_api_key", value),
        updateCloudAsrBaseUrl: (value) =>
          get().updateSetting("cloud_asr_base_url", value),
        updateCloudAsrModel: (value) =>
          get().updateSetting("cloud_asr_model", value),
        updateCloudAsrScreenContext: (value) =>
          get().updateSetting("cloud_asr_screen_context", value),
      };
    }),
  );
};

function checkResult(result: unknown): void {
  if (
    result &&
    typeof result === "object" &&
    "status" in result &&
    result.status === "error"
  ) {
    throw new Error(
      String("error" in result ? result.error : "Command failed"),
    );
  }
}

export const useSettingsStore = createSettingsStore();
