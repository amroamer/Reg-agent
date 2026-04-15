"use client";

import { useI18n } from "@/lib/i18n/context";

export function useLanguage() {
  const { language, direction, setLanguage, t } = useI18n();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  const isRTL = direction === "rtl";
  const isArabic = language === "ar";

  return {
    language,
    direction,
    isRTL,
    isArabic,
    setLanguage,
    toggleLanguage,
    t,
  };
}
