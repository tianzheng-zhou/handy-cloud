import { test, expect } from "@playwright/test";
import { mockTauri } from "./helpers/tauri";

test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.__handyMock.unknown)).toEqual([]);
});

test("onboarding requires a key and persists completion", async ({ page }) => {
  await mockTauri(page, false);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("An API key is required to continue"),
  ).toBeVisible();
  await page.getByPlaceholder("sk-...").fill("test-onboarding-key");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__handyMock.settings.cloud_asr_api_key),
  ).toBe("test-onboarding-key");
  expect(
    await page.evaluate(() => window.__handyMock.settings.onboarding_completed),
  ).toBe(true);
});

test("cloud model changes persist; backend errors show a toast and restore the selection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockTauri(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ASR", exact: true }).click();
  const plus = page.getByRole("button", {
    name: "Qwen3.5-Omni Plus",
    exact: true,
  });
  const flash = page.getByRole("button", {
    name: "Qwen3.5-Omni Flash",
    exact: true,
  });
  const flash38 = page.getByRole("button", {
    name: "Qwen3.8-Omni Flash",
    exact: true,
  });
  await plus.click();
  await expect(plus).toHaveAttribute("aria-pressed", "true");
  await flash38.click();
  await expect(flash38).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => window.__handyMock.settings.cloud_asr_model),
  ).toBe("qwen3.8-omni-flash");
  await page.getByRole("button", { name: "General", exact: true }).click();
  await page.getByRole("button", { name: "ASR", exact: true }).click();
  await expect(flash38).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('span[title="Qwen3.8-Omni Flash"]')).toBeVisible();
  await page.evaluate(() => {
    window.__handyMock.failNext = "change_cloud_asr_model";
  });
  await flash.click();
  await expect(
    page.getByText("Could not save settings. Please try again."),
  ).toBeVisible();
  await expect(flash38).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => window.__handyMock.settings.cloud_asr_model),
  ).toBe("qwen3.8-omni-flash");
  expect(errors).toEqual([]);
});

test("history renders IPC results and reacts to history events", async ({
  page,
}) => {
  await mockTauri(page);
  await page.goto("/");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByText("你好，Handy Cloud。", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.__handyMock.emit("history-update-payload", {
      action: "added",
      entry: {
        id: 2,
        file_name: "new.wav",
        timestamp: 1750000001,
        saved: false,
        title: "New",
        transcription_text: "New dictation event",
        post_processed_text: null,
        post_process_prompt: null,
        post_process_requested: false,
      },
    }),
  );
  await expect(
    page.getByText("New dictation event", { exact: true }),
  ).toBeVisible();
});

test("locale loads on demand, switches to Chinese, and is reused on the next switch", async ({
  page,
}) => {
  const localeRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/locales/")) localeRequests.push(request.url());
  });
  await mockTauri(page);
  await page.goto("/");
  await page.getByRole("button", { name: "About", exact: true }).click();
  expect(localeRequests.some((url) => url.includes("/zh/"))).toBe(false);
  await page
    .getByRole("button", { name: "English (English)", exact: true })
    .click();
  await page.getByRole("button", { name: /简体中文/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(
    page.getByRole("button", { name: "通用", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__handyMock.settings.app_language),
  ).toBe("zh");
  const loaded = localeRequests.filter((url) => url.includes("/zh/")).length;
  expect(loaded).toBe(1);
  await page.getByRole("button", { name: /简体中文/ }).click();
  await page
    .getByRole("button", { name: "English (English)", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .getByRole("button", { name: "English (English)", exact: true })
    .click();
  await page.getByRole("button", { name: /简体中文/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  expect(localeRequests.filter((url) => url.includes("/zh/")).length).toBe(
    loaded,
  );
  expect(
    await page.evaluate(
      () =>
        window.__handyMock.calls.filter((c) => c === "get_app_settings").length,
    ),
  ).toBe(1);
});

test("screen capture method can be changed while screen context is off; X11 direct only in X11 sessions", async ({
  page,
}) => {
  await mockTauri(page);
  await page.addInitScript(() => {
    window.__handyMock.x11Session = true;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Use screen as context" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Screenshot (may flash)" }).click();
  await page
    .getByRole("button", { name: "X11 direct (silent, recommended)" })
    .click();
  await expect(
    page.getByRole("button", { name: "X11 direct (silent, recommended)" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => window.__handyMock.settings.cloud_asr_screen_capture_method,
    ),
  ).toBe("x11");
  expect(await page.evaluate(() => window.__handyMock.calls)).not.toContain(
    "change_cloud_asr_screen_context",
  );
});

test("X11 direct capture is not offered outside X11 sessions", async ({
  page,
}) => {
  await mockTauri(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByRole("button", { name: "Screenshot (may flash)" }).click();
  await expect(
    page.getByRole("button", { name: "ScreenCast (silent)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "X11 direct (silent, recommended)" }),
  ).toHaveCount(0);
});

test("post-processing can run in the Omni ASR model itself, without API settings", async ({
  page,
}) => {
  await mockTauri(page);
  await page.addInitScript(() => {
    const provider = (id: string, label: string) => ({
      id,
      label,
      base_url: `https://${id}.invalid/v1`,
      allow_base_url_edit: false,
      models_endpoint: "/models",
      supports_structured_output: true,
    });
    Object.assign(window.__handyMock.settings, {
      post_process_enabled: true,
      post_process_provider_id: "openai",
      // Migrated settings list it last; the UI still shows it first.
      post_process_providers: [
        provider("openai", "OpenAI"),
        {
          ...provider("omni_self", "ASR model itself (Qwen Omni)"),
          models_endpoint: null,
          supports_structured_output: false,
        },
      ],
      post_process_api_keys: { openai: "", omni_self: "" },
      post_process_models: { openai: "", omni_self: "" },
      post_process_prompts: [],
      post_process_selected_prompt_id: null,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Post Process", exact: true }).click();
  await expect(page.getByText("API Key", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "OpenAI" }).click();
  const options = page.getByRole("button", {
    name: /^(OpenAI|ASR model itself \(Qwen Omni\))$/,
  });
  // The dropdown trigger, then the menu with the Omni option listed first.
  await expect(options).toHaveText([
    "OpenAI",
    "ASR model itself (Qwen Omni)",
    "OpenAI",
  ]);
  await options.nth(1).click();

  await expect(page.getByText(/no second call/)).toBeVisible();
  await expect(page.getByText("API Key", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Model", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.__handyMock.settings.post_process_provider_id,
    ),
  ).toBe("omni_self");
  expect(await page.evaluate(() => window.__handyMock.calls)).not.toContain(
    "fetch_post_process_models",
  );
});
