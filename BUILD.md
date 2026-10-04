# Building Handy Cloud

Use **Bun 1.4.2** (the version in `packageManager`) and latest stable Rust with rustfmt and Clippy. Bun is the supported package manager; commit `bun.lock` and the generated `.nix/bun.nix` / `.nix/bun-lock-hash` together. Do not add npm/yarn/pnpm lockfiles.

## Native dependencies

Ubuntu 24.04:

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config cmake curl \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
  libasound2-dev libssl-dev libgtk-layer-shell-dev \
  libxdo-dev libx11-dev libxtst-dev libxrandr-dev
```

For Linux screen context, also install the desktop's `xdg-desktop-portal` backend, PipeWire, `gstreamer1.0-tools` and `gstreamer1.0-pipewire`. This is runtime functionality, not required by unit tests.

Windows: install Visual Studio Build Tools with Desktop development with C++, the Windows SDK, and WebView2. Use the MSVC Rust toolchain. macOS: install Xcode and its command line tools; Apple Silicon builds compile the Swift bridge for optional Apple Intelligence post-processing (or its fallback stub on older SDKs).

ONNX Runtime remains required for Silero VAD. The Rust `ort` dependency normally downloads its native runtime at build time. If its download service is unavailable, use the matching [official ONNX Runtime release](https://github.com/microsoft/onnxruntime/releases/tag/v1.24.2), extract it, and set `ORT_LIB_LOCATION` to its `lib` directory and `ORT_PREFER_DYNAMIC_LINK=1`. On Linux also add that directory to `LD_LIBRARY_PATH` when testing. Do not enable local ASR GPU dependencies: Vulkan, shaderc and OpenBLAS are not needed by Handy Cloud.

## Setup and run

```bash
bun install --frozen-lockfile
mkdir -p src-tauri/resources/models
curl --fail --location --retry 3 \
  -o src-tauri/resources/models/silero_vad_v4.onnx \
  https://blob.handy.computer/silero_vad_v4.onnx
bun run tauri dev
```

The VAD file is the only required model download. Configure a Bailian API Key in onboarding. No local Whisper/Parakeet models are used. Keep keys out of source control.

For a macOS CMake policy compatibility error, use `CMAKE_POLICY_VERSION_MINIMUM=3.5 bun run tauri dev`.

## Checks

```bash
bun run typecheck
bun run lint
bun run format:check
bun run check:translations
bun run check:nix-deps
bun test tests/unit
bun run build
bun run check:bundle
bunx playwright install chromium
bun run test:playwright
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
bun run bindings
git diff -- src/bindings.ts
```

Type checking does not emit Vite configuration files. Build/dev/preview explicitly use `vite.config.ts`. `bun run bindings` runs the debug-only exporter without starting Tauri windows or touching user data; review and commit binding changes. Rust business tests and Playwright IPC mocks need neither cloud credentials nor actual microphone recordings. HTTP tests bind local loopback sockets.

Playwright tests cover onboarding, cloud model persistence and errors, history events, and language loading/cache. They do not exercise native shortcuts, portals, microphone hardware or OS paste permissions. On Ubuntu 26.04, Playwright 1.58 does not yet identify the distro; local verification can use `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` with compatible native libraries. CI runs Ubuntu 24.04.

## Packages and updates

```bash
bun run tauri build
# Linux examples:
bun run tauri build --bundles deb
bun run tauri build --bundles appimage,rpm
```

Artifacts are in `src-tauri/target/release/bundle/` (or the target triple's directory when cross-compiling). Binary: `handy-cloud` / `handy-cloud.exe`; macOS app: `Handy Cloud.app`. Build natively on each OS for package validation.

Ordinary packages are unsigned (macOS uses ad-hoc signing). No publisher credentials or updater keys are required. The **Main Branch Build** workflow is manual and builds the full Linux/macOS/Windows matrix (including ARM) as downloadable Actions artifacts without creating a Release. OS signing/notarization is not set up.

## Releasing

Versions follow semver independently of upstream Handy; tags are `v<version>`.

```bash
bun run version:bump 0.2.0   # package.json, tauri.conf.json, Cargo.toml, Cargo.lock
# optionally add src/content/release-notes/0.2.0.md for the in-app "What's new"
git commit -am "chore: release v0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

The **Release** workflow checks that the tag matches the declared version, runs the Checks workflow plus native Rust tests/Clippy on Windows and macOS, builds Linux x64 (deb, AppImage, rpm), Windows x64 (NSIS, MSI) and macOS (Apple Silicon, Intel), then opens a **draft** Release with notes from `scripts/release-notes.ts`. Review the notes and publish it manually. A tag containing `-` (e.g. `v0.2.0-rc.1`) is marked as a pre-release. Linux x64 is verified on hardware; Windows and macOS packages are labelled experimental in the notes until verified on real machines.

Updater controls and tray entry are governed by `get_update_capability`. To enable later, configure this project's HTTPS endpoint and public key, enable updater artifacts, and provide the matching signing key only to a dedicated release process. Never reuse the upstream endpoint/key. Follow [Tauri's updater signing requirements](https://v2.tauri.app/plugin/updater/#signing-updates).

## Nix

```bash
nix develop
nix build .#handy
```

The existing `handy` Nix package/module option names remain for configuration compatibility; the installed program is `handy-cloud`. Dependencies include ONNX Runtime for VAD and GTK layer shell, not Vulkan. `bun install` regenerates Nix dependencies with pinned bun2nix 2.0.8; `bun run check:nix-deps` checks the lock digest without modifying files. The manual Nix workflow also regenerates the expression and compares it.

## Platform acceptance

Before publishing, verify Linux shortcuts, VAD, cloud cancellation, paste and screen context in a desktop session. Verify macOS accessibility/microphone/screen-recording permissions and paste, and Windows microphone/privacy and paste on real machines. A successful compiler or mock-browser run alone does not establish those behaviors. Record unavailable CI jobs (including GitHub billing restrictions) as **not run**, not passed.
