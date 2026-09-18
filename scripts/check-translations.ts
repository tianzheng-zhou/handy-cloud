import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function flatten(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { [prefix]: value };
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      Object.entries(flatten(child, prefix ? `${prefix}.${key}` : key)),
    ),
  );
}

export function interpolationVariables(value: string): string[] {
  return [
    ...new Set(
      [...value.matchAll(/{{\s*-?\s*([^},\s]+)(?:[^}]*?)}}/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
}

export function validate(
  reference: Record<string, unknown>,
  locale: Record<string, unknown>,
): string[] {
  const source = flatten(reference);
  const target = flatten(locale);
  const errors: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`Invalid source string: ${key}`);
      continue;
    }
    const translated = target[key];
    if (typeof translated !== "string" || !translated.trim()) {
      errors.push(`Missing/invalid: ${key}`);
      continue;
    }
    if (
      JSON.stringify(interpolationVariables(value)) !==
      JSON.stringify(interpolationVariables(translated))
    ) {
      errors.push(`Interpolation variables differ: ${key}`);
    }
  }
  for (const key of Object.keys(target))
    if (!(key in source)) errors.push(`Extra: ${key}`);
  return errors;
}

if (import.meta.main) {
  const root = resolve(import.meta.dirname, "../src/i18n/locales");
  const read = (language: string) =>
    JSON.parse(
      readFileSync(resolve(root, language, "translation.json"), "utf8"),
    );
  const source = read("en");
  let failed = false;
  for (const language of readdirSync(root).sort()) {
    const errors = validate(source, read(language));
    console.log(
      `${language}: ${errors.length ? errors.join("\n  ") : "keys and interpolation variables valid"}`,
    );
    failed ||= errors.length > 0;
  }
  process.exitCode = failed ? 1 : 0;
}
