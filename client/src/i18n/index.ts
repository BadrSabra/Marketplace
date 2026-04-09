import { ar } from "./ar";

export const languages = {
  ar,
};

export type Language = keyof typeof languages;

export const defaultLanguage: Language = "ar";

type DeepRecord = { [key: string]: string | DeepRecord };

function getNestedValue(obj: DeepRecord, path: string): string {
  const parts = path.split(".");
  let current: string | DeepRecord = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return path;
    current = (current as DeepRecord)[part];
    if (current === undefined) return path;
  }
  return typeof current === "string" ? current : path;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = getNestedValue(ar as unknown as DeepRecord, key);
  if (!vars || raw === key) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}
