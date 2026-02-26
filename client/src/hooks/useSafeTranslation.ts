import { languages, defaultLanguage } from "@/i18n";

export function useSafeTranslation() {
  const lang = defaultLanguage;

  function t(path: string): string {
    const keys = path.split(".");
    let value: any = languages[lang];

    for (const key of keys) {
      if (!value || !value[key]) return path;
      value = value[key];
    }

    return value;
  }

  return { t };
}
