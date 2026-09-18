import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AppSettings } from "../../src/bindings";

const ok = <T>(data: T) => ({ status: "ok" as const, data });
let saved: AppSettings;
const api = {
  getAppSettings: mock(async () => ok({ ...saved })),
  getDefaultSettings: mock(async () => ok({ ...saved })),
  checkCustomSounds: mock(async () => ({ start: false, stop: false })),
  changeAudioFeedbackSetting: mock(async (value: boolean) => {
    saved.audio_feedback = value;
    return ok(null);
  }),
  changeHistoryLimitSetting: mock(async () => ok(null)),
  updateHistoryLimit: mock(async (value: number) => {
    saved.history_limit = value;
    return ok(null);
  }),
  changeCloudAsrModel: mock(async (value: string) => {
    saved.cloud_asr_model = value;
    return ok(null);
  }),
};
mock.module("../../src/bindings", () => ({ commands: api }));
const { createSettingsStore } = await import("../../src/stores/settingsStore");
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  saved = {
    audio_feedback: false,
    history_limit: 100,
    cloud_asr_model: "flash",
  };
  for (const command of Object.values(api)) command.mockClear();
});

describe("settings transactions", () => {
  test("initialization is shared across all mounted consumers", async () => {
    const store = createSettingsStore();
    await Promise.all(
      Array.from({ length: 20 }, () => store.getState().initialize()),
    );
    expect(api.getAppSettings).toHaveBeenCalledTimes(1);
    expect(api.getDefaultSettings).toHaveBeenCalledTimes(1);
    expect(api.checkCustomSounds).toHaveBeenCalledTimes(1);
    expect(store.getState().isLoading).toBe(false);
  });

  test("a resolved Tauri error rolls back only its field", async () => {
    const failure = deferred<
      ReturnType<typeof ok<null>> | { status: "error"; error: string }
    >();
    api.changeAudioFeedbackSetting.mockImplementationOnce(
      () => failure.promise as Promise<ReturnType<typeof ok<null>>>,
    );
    const store = createSettingsStore();
    await store.getState().initialize();
    const pending = store.getState().updateSetting("audio_feedback", true);
    await store.getState().updateSetting("history_limit", 300);
    failure.resolve({ status: "error", error: "Disk full" });
    await expect(pending).rejects.toThrow("Disk full");
    expect(store.getState().settings?.audio_feedback).toBe(false);
    expect(store.getState().settings?.history_limit).toBe(300);
    expect(store.getState().lastError?.message).toContain("Disk full");
  });

  test("same field writes run in order and a failure does not block the next", async () => {
    const first = deferred<ReturnType<typeof ok<null>>>();
    api.changeCloudAsrModel.mockImplementationOnce(() => first.promise);
    const store = createSettingsStore();
    await store.getState().initialize();
    const one = store.getState().updateSetting("cloud_asr_model", "plus");
    const two = store.getState().updateSetting("cloud_asr_model", "flash");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.changeCloudAsrModel).toHaveBeenCalledTimes(1);
    first.resolve(ok(null));
    await Promise.all([one, two]);
    expect(api.changeCloudAsrModel.mock.calls.map(([value]) => value)).toEqual([
      "plus",
      "flash",
    ]);
    expect(store.getState().settings?.cloud_asr_model).toBe("flash");
  });

  test("background refresh cannot overwrite pending optimistic values", async () => {
    const pending = deferred<ReturnType<typeof ok<null>>>();
    api.changeCloudAsrModel.mockImplementationOnce(() => pending.promise);
    const store = createSettingsStore();
    await store.getState().initialize();
    const update = store.getState().updateSetting("cloud_asr_model", "plus");
    await new Promise((resolve) => setTimeout(resolve, 0));
    saved.cloud_asr_screencast_restore_token = "new-token";
    await store.getState().refreshSettings();
    expect(store.getState().settings?.cloud_asr_model).toBe("plus");
    expect(store.getState().settings?.cloud_asr_screencast_restore_token).toBe(
      "new-token",
    );
    pending.resolve(ok(null));
    await update;
  });
});
