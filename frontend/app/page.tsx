"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import Header from "@/components/layout/Header";
import SearchBar from "@/components/search/SearchBar";
import {
  Shield,
  FileText,
  Building2,
  Activity,
  Lock,
  Scale,
} from "lucide-react";

const TOPICS = [
  { en: "Credit Cards", ar: "بطاقات الائتمان", icon: FileText, query: "credit card regulations" },
  { en: "Anti-Money Laundering", ar: "مكافحة غسل الأموال", icon: Shield, query: "anti-money laundering" },
  { en: "Consumer Protection", ar: "حماية العملاء", icon: Scale, query: "consumer protection" },
  { en: "Capital Adequacy", ar: "كفاية رأس المال", icon: Activity, query: "capital adequacy requirements" },
  { en: "Data Privacy", ar: "خصوصية البيانات", icon: Lock, query: "data privacy" },
  { en: "Corporate Governance", ar: "حوكمة الشركات", icon: Building2, query: "corporate governance" },
];

export default function Home() {
  const router = useRouter();
  const { language, t } = useLanguage();

  const handleSearch = (query: string, sources: string[]) => {
    const params = new URLSearchParams({ q: query });
    if (sources.length) params.set("sources", sources.join(","));
    router.push(`/search?${params}`);
  };

  const handleTopicClick = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-gradient-to-b from-kpmg-blue/5 to-white">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-kpmg-blue mb-2">
            RegInspector
          </h2>
          <p className="text-2xl font-arabic text-kpmg-blue/80 mb-4">
            مُفتِّش الأنظمة
          </p>
          <p className="text-lg text-gray-600 mb-8">
            {t("appSubtitle")}
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-arabic">{t("appSubtitleAr")}</span>
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Quick Access Topics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {TOPICS.map((topic) => (
              <button
                key={topic.en}
                onClick={() => handleTopicClick(topic.query)}
                className="p-4 rounded-xl border border-gray-200 hover:border-kpmg-blue/30 hover:bg-kpmg-blue/5 transition text-start group"
              >
                <topic.icon className="w-5 h-5 text-kpmg-blue mb-2 group-hover:text-kpmg-blue-light transition" />
                <p className="text-sm font-medium text-gray-800">
                  {language === "ar" ? topic.ar : topic.en}
                </p>
                <p className="text-xs text-gray-500 font-arabic mt-1">
                  {language === "ar" ? topic.en : topic.ar}
                </p>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between text-xs text-gray-500">
          <span>RegInspector v1.0.0</span>
          <span>KPMG Saudi Arabia</span>
        </div>
      </footer>
    </div>
  );
}
