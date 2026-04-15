"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import ar from "./ar";
import en, { type TranslationKey } from "./en";

type Language = "en" | "ar";
type Direction = "ltr" | "rtl";

interface I18nContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const translations = { en, ar };

const I18nContext = createContext<I18nContextType>({
  language: "en",
  direction: "ltr",
  setLanguage: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem("language") as Language | null;
    if (saved && (saved === "en" || saved === "ar")) {
      setLanguageState(saved);
    }
  }, []);

  useEffect(() => {
    // Update HTML attributes
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language]?.[key] ?? translations.en[key] ?? key;
    },
    [language],
  );

  return (
    <I18nContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
