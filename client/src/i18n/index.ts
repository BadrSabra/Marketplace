import { ar } from "./ar";

export const languages = {
  ar,
};

export type Language = keyof typeof languages;

export const defaultLanguage: Language = "ar";
