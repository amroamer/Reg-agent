"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { Globe } from "lucide-react";

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 transition"
      title={language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
    >
      <Globe className="w-4 h-4" />
      <span>{language === "en" ? "عربي" : "EN"}</span>
    </button>
  );
}
