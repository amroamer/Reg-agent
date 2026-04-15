"use client";

import { useLanguage } from "@/hooks/useLanguage";
import Header from "@/components/layout/Header";
import { Globe, Settings } from "lucide-react";

export default function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t("settings")}
        </h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-kpmg-blue" />
            <h2 className="font-semibold text-gray-800">
              {language === "ar" ? "اللغة" : "Language"}
            </h2>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setLanguage("en")}
              className={`flex-1 p-4 rounded-lg border-2 transition ${
                language === "en"
                  ? "border-kpmg-blue bg-kpmg-blue/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium text-gray-900">English</p>
              <p className="text-xs text-gray-500 mt-1">
                Left-to-right interface
              </p>
            </button>
            <button
              onClick={() => setLanguage("ar")}
              className={`flex-1 p-4 rounded-lg border-2 transition ${
                language === "ar"
                  ? "border-kpmg-blue bg-kpmg-blue/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium text-gray-900 font-arabic">العربية</p>
              <p className="text-xs text-gray-500 mt-1 font-arabic">
                واجهة من اليمين إلى اليسار
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
