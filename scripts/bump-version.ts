// Sets the app version everywhere it is declared, so tags, bundles and the
// `--locked` Cargo build stay in agreement. Usage: bun run version:bump 0.2.0
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const version = process.argv[2]?.replace(/^v/, "");

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: bun run version:bump <major.minor.patch[-pre]>");
  process.exit(1);
}

function replaceOnce(file: string, pattern: RegExp, replacement: string) {
  const path = resolve(root, file);
  const source = readFileSync(path, "utf8");
  if (!pattern.test(source)) {
    console.error(`Version field not found in ${file}`);
    process.exit(1);
  }
  writeFileSync(path, source.replace(pattern, replacement));
  console.log(`${file} -> ${version}`);
}

replaceOnce("package.json", /("version":\s*")[^"]+(")/, `$1${version}$2`);
replaceOnce(
  "src-tauri/tauri.conf.json",
  /("version":\s*")[^"]+(")/,
  `$1${version}$2`,
);
replaceOnce(
  "src-tauri/Cargo.toml",
  /(\[package\]\s*\nname = "handy"\s*\nversion = ")[^"]+(")/,
  `$1${version}$2`,
);
replaceOnce(
  "src-tauri/Cargo.lock",
  /(\[\[package\]\]\s*\nname = "handy"\s*\nversion = ")[^"]+(")/,
  `$1${version}$2`,
);

const note = `src/content/release-notes/${version}.md`;
if (!existsSync(resolve(root, note))) {
  console.log(`Optional: add ${note} to show an in-app "What's new" note.`);
}
