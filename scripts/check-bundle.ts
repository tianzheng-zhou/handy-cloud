import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

type Chunk = { file: string; imports?: string[] };
const root = resolve(import.meta.dirname, "../dist");
const manifest: Record<string, Chunk> = JSON.parse(
  readFileSync(resolve(root, ".vite/manifest.json"), "utf8"),
);
const baselineBytes = 1_365_460; // main 486.34 kB + shared 879.12 kB, before optimization.
const baselineGzipBytes = 396_530;
function measure(entries: string[]) {
  const files = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing manifest entry: ${key}`);
    if (chunk.file.endsWith(".js")) files.add(chunk.file);
    for (const imported of chunk.imports ?? []) visit(imported);
  }
  entries.forEach(visit);
  const buffers = [...files].map((file) => readFileSync(resolve(root, file)));
  return {
    bytes: buffers.reduce((sum, data) => sum + data.byteLength, 0),
    gzipBytes: buffers.reduce(
      (sum, data) => sum + gzipSync(data).byteLength,
      0,
    ),
    files: [...files].sort(),
  };
}
const entries = [
  "index.html",
  "src/components/settings/general/GeneralSettings.tsx",
];
const english = measure(entries);
const chinese = measure([...entries, "src/i18n/locales/zh/translation.json"]);
const upgrade = measure([
  ...entries,
  "src/components/whats-new/WhatsNewModal.tsx",
]);
console.log(
  JSON.stringify(
    {
      baselineBytes,
      baselineGzipBytes,
      english,
      chinese,
      upgrade,
      reductionPercent: Number(
        ((1 - english.bytes / baselineBytes) * 100).toFixed(2),
      ),
    },
    null,
    2,
  ),
);
if (
  english.bytes > baselineBytes * 0.7 ||
  chinese.bytes > baselineBytes * 0.7
) {
  throw new Error("Initial JS exceeds the 30% reduction budget");
}
