import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import arTranslations from './locales/ar.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: {
        translation: arTranslations,
      },
    },
    fallbackLng: 'ar',
    lng: 'ar',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
