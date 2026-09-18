# Translating Handy Cloud

English (`src/i18n/locales/en/translation.json`) defines the keys and interpolation variables. Simplified Chinese (`zh`) is maintained alongside English. All 24 existing languages are retained.

English is bundled at startup; other languages load on selection and are cached. Missing new translations currently contain the **English fallback text**, rather than guessed translations. [english-fallbacks.json](src/i18n/english-fallbacks.json) lists these entries. Remove an entry from that list after translating it. The runtime also falls back to English if a resource cannot load.

1. Edit your language's `translation.json`; translate values, never keys.
2. Preserve every `{{variable}}` (including formatted or unescaped interpolations).
3. Keep the same key structure as English. Removed local ASR features should not be reintroduced.
4. Run `bun run check:translations` and `bun run format:frontend`. The checker rejects missing/extra keys, invalid strings and interpolation mismatches; it does not waive missing entries for incomplete languages.
5. Verify the language in **About → App Language**, including RTL layout where applicable.
6. Follow [CONTRIBUTING.md](CONTRIBUTING.md) and the full PR template.

For a new language, copy English into a new locale directory and add its metadata to `src/i18n/languages.ts`. Traditional Chinese uses `zh-TW`; language normalization also supports script/region variants. Placeholders, product names and API identifiers may appropriately remain unchanged.
