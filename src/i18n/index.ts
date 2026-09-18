import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { locale } from "@tauri-apps/plugin-os";
import { LANGUAGE_METADATA } from "./languages";
import { useSettingsStore } from "@/stores/settingsStore";
import english from "./locales/en/translation.json";
import {
  getLanguageDirection,
  updateDocumentDirection,
  updateDocumentLanguage,
} from "@/lib/utils/rtl";

// English is the only eager locale. i18next waits for the selected locale and
// caches it; Vite emits a separate chunk for each remaining language.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>([
  "./locales/*/translation.json",
  "!./locales/en/translation.json",
]);
const languageCodes = [
  "en",
  ...Object.keys(localeModules).map((path) => path.split("/")[2]),
];
const loads = new Map<string, Promise<Record<string, unknown>>>();
const localeBackend = {
  type: "backend" as const,
  init() {},
  read(
    language: string,
    _namespace: string,
    callback: (
      error: Error | null,
      data: Record<string, unknown> | false,
    ) => void,
  ) {
    const loader = localeModules[`./locales/${language}/translation.json`];
    if (!loader) {
      callback(null, {});
      return;
    }
    let pending = loads.get(language);
    if (!pending) {
      pending = loader().then((module) => module.default);
      loads.set(language, pending);
      void pending.catch(() => loads.delete(language));
    }
    void pending.then(
      (data) => callback(null, data),
      (error) => callback(error, false),
    );
  },
};

export const SUPPORTED_LANGUAGES = languageCodes
  .map((code) => {
    const meta = LANGUAGE_METADATA[code];
    if (!meta) {
      console.warn(`Missing metadata for locale "${code}" in languages.ts`);
      return { code, name: code, nativeName: code, priority: undefined };
    }
    return {
      code,
      name: meta.name,
      nativeName: meta.nativeName,
      priority: meta.priority,
    };
  })
  .sort((a, b) => {
    // Sort by priority first (lower = higher), then alphabetically
    if (a.priority !== undefined && b.priority !== undefined) {
      return a.priority - b.priority;
    }
    if (a.priority !== undefined) return -1;
    if (b.priority !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });

export type SupportedLanguageCode = string;

// Check if a language code is supported
export const getSupportedLanguage = (
  langCode: string | null | undefined,
): SupportedLanguageCode | null => {
  if (!langCode) return null;

  const normalized = langCode.toLowerCase().replace(/_/g, "-");
  const subtags = normalized.split("-");
  const language = subtags[0];
  const isHant = subtags.includes("hant");
  const isHans = subtags.includes("hans");
  const isTraditionalRegion = ["tw", "hk", "mo"].some((region) =>
    subtags.includes(region),
  );

  // Try exact match first
  let supported = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code.toLowerCase() === normalized,
  );
  if (!supported) {
    let fallback = language;
    if (language === "zh" && (isHant || (!isHans && isTraditionalRegion))) {
      fallback = "zh-tw";
    } else if (language === "yue") {
      // Cantonese uses Traditional Chinese unless explicitly tagged as Hans.
      fallback = isHans ? "zh" : "zh-tw";
    }
    supported = SUPPORTED_LANGUAGES.find(
      (lang) => lang.code.toLowerCase() === fallback,
    );
  }
  return supported ? supported.code : null;
};

// Initialize i18n with English as default
// Language will be synced from settings after init
i18n
  .use(localeBackend)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: english } },
    partialBundledLanguages: true,
    supportedLngs: languageCodes,
    load: "currentOnly",
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },
  });

// Sync language from app settings
export const syncLanguageFromSettings = async () => {
  try {
    await useSettingsStore.getState().initialize();
    const language = useSettingsStore.getState().settings?.app_language;
    if (language) {
      const supported = getSupportedLanguage(language);
      if (supported && supported !== i18n.language) {
        await i18n.changeLanguage(supported);
      }
    } else {
      // Fall back to system locale detection if no saved preference
      const systemLocale = await locale();
      const supported = getSupportedLanguage(systemLocale);
      if (supported && supported !== i18n.language) {
        await i18n.changeLanguage(supported);
      }
    }
  } catch (e) {
    console.warn("Failed to sync language from settings:", e);
  }
};

// Run language sync on init
syncLanguageFromSettings();

// Listen for language changes to update HTML dir and lang attributes
i18n.on("languageChanged", (lng) => {
  const dir = getLanguageDirection(lng);
  updateDocumentDirection(dir);
  updateDocumentLanguage(lng);
});

// Re-export RTL utilities for convenience
export { getLanguageDirection, isRTLLanguage } from "@/lib/utils/rtl";

export default i18n;
