import { t as i18nT } from "@/i18n";

export function useSafeTranslation() {
  function t(path: string): string {
    return i18nT(path);
  }

  return { t };
}
