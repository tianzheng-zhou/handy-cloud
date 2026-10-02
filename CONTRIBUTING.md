# Contributing to Handy Cloud

Handy Cloud is a cloud-transcription fork of [Handy](https://github.com/cjpais/Handy). Report this fork's bugs and propose changes in [tianzheng-zhou/handy-cloud](https://github.com/tianzheng-zhou/handy-cloud). Preserve the upstream copyright and contributor credits.

The current priority is simplification, reliability and Linux support while keeping Windows/macOS compatibility. Open an issue to discuss larger features before starting a PR. Avoid unrelated dependency upgrades. Cloud models and transcription prompts should only change in explicitly reviewed work.

## Development

Follow [BUILD.md](BUILD.md), using Bun and stable Rust. Use conventional commit prefixes (`fix:`, `refactor:`, `docs:`, `chore:`, `feat:`) and explain why the change is needed. Keep stages independently buildable and reversible.

Frontend strings belong in i18next; see [CONTRIBUTING_TRANSLATIONS.md](CONTRIBUTING_TRANSLATIONS.md). Subscribe controls with `useSetting(key)` and `useSettingUpdating(key)` where possible. Settings actions must unwrap generated Tauri Results, preserve unrelated fields on failure, and serialize writes to a shared field.

Backend mutations go through `settings::update_settings`, with OS operations outside the settings lock. API keys must not appear in logs. Preserve cancellation across cloud requests, post-processing and paste. Do not retry chargeable requests automatically. Regenerate bindings with `bun run bindings` after changing commands/types.

Run frontend type/build/lint/format/translation checks, Bun business tests, relevant IPC browser tests, Rust tests and Clippy. Add regression coverage for meaningful bugs; report native platform testing separately from mocks. The daily Checks workflow runs frontend and Linux Rust checks. Packaging and Nix builds are manual.

## Submissions

Use the standard GitHub flow: open an [issue](https://github.com/tianzheng-zhou/handy-cloud/issues) with the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template, then submit a PR that follows the [PR template](.github/PULL_REQUEST_TEMPLATE.md) and links the issue with `Closes #N`. Small, obvious fixes may go straight to a PR. Include reproduction, test evidence and affected platforms, and disclose AI assistance. Never attach API keys, private recordings or unredacted settings.
