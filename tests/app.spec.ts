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
