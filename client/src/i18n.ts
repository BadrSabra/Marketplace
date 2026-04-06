import translations from "./locales/ar/translation.json";

export function t(key: string, vars?: Record<string, string | number>): string {
  const keys = key.split(".");
  let value: any = translations;
  for (const k of keys) {
    if (value && value[k] !== undefined) value = value[k];
    else return key;
  }
  if (typeof value === "string" && vars) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
  }
  return typeof value === "string" ? value : key;
}

export default { t };
