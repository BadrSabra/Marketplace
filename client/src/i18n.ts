import translations from "./locales/ar/translation.json";

export function t(key: string) {
  const keys = key.split(".");
  let value: any = translations;
  for (const k of keys) {
    if (value && value[k] !== undefined) value = value[k];
    else return key;
  }
  return value;
}

export default { t };
