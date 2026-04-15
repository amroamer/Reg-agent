"use client";

import { useEffect, useState } from "react";
import { Search, Shield, FileText, Building2, Activity } from "lucide-react";

type HealthStatus = {
  status: string;
  checks?: {
    postgres?: string;
    redis?: string;
    qdrant?: string;
  };
};

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => {
        setHealth({ status: "unreachable" });
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-kpmg-blue text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">KPMG</h1>
              <p className="text-xs text-white/70">Saudi Arabia</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button className="px-3 py-1 rounded hover:bg-white/10 transition">
              EN
            </button>
            <span className="text-white/30">|</span>
            <button className="px-3 py-1 rounded hover:bg-white/10 transition font-arabic">
              عربي
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-gradient-to-b from-kpmg-blue/5 to-white">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-kpmg-blue mb-2">
            RegInspector
          </h2>
          <p className="text-2xl font-arabic text-kpmg-blue/80 mb-4">
            مُفتِّش الأنظمة
          </p>
          <p className="text-lg text-gray-600 mb-8">
            Regulatory Intelligence Platform
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-arabic">منصة الذكاء التنظيمي</span>
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search regulations... | ...ابحث في الأنظمة"
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-kpmg-blue focus:outline-none transition shadow-sm hover:shadow-md"
                dir="auto"
              />
            </div>
            <div className="flex items-center gap-2 mt-3 justify-center">
              <span className="px-3 py-1 text-sm rounded-full bg-kpmg-blue text-white cursor-pointer">
                All
              </span>
              <span className="px-3 py-1 text-sm rounded-full badge-sama cursor-pointer font-medium">
                SAMA
              </span>
              <span className="px-3 py-1 text-sm rounded-full badge-cma cursor-pointer font-medium">
                CMA
              </span>
              <span className="px-3 py-1 text-sm rounded-full badge-bank cursor-pointer font-medium">
                Bank Policies
              </span>
            </div>
          </div>

          {/* Quick Access Topics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
            {[
              {
                en: "Credit Cards",
                ar: "بطاقات الائتمان",
                icon: FileText,
              },
              {
                en: "Anti-Money Laundering",
                ar: "مكافحة غسل الأموال",
                icon: Shield,
              },
              {
                en: "Consumer Protection",
                ar: "حماية العملاء",
                icon: Building2,
              },
              {
                en: "Capital Adequacy",
                ar: "كفاية رأس المال",
                icon: Activity,
              },
              {
                en: "Data Privacy",
                ar: "خصوصية البيانات",
                icon: Shield,
              },
              {
                en: "Corporate Governance",
                ar: "حوكمة الشركات",
                icon: Building2,
              },
            ].map((topic) => (
              <button
                key={topic.en}
                className="p-4 rounded-xl border border-gray-200 hover:border-kpmg-blue/30 hover:bg-kpmg-blue/5 transition text-left group"
              >
                <topic.icon className="w-5 h-5 text-kpmg-blue mb-2 group-hover:text-kpmg-blue-light transition" />
                <p className="text-sm font-medium text-gray-800">
                  {topic.en}
                </p>
                <p className="text-xs text-gray-500 font-arabic mt-1">
                  {topic.ar}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Health Status Bar */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between text-xs text-gray-500">
          <span>RegInspector v1.0.0</span>
          <div className="flex items-center gap-4">
            {loading ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                Connecting...
              </span>
            ) : health?.status === "healthy" ? (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  All systems operational
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {health?.status || "Unreachable"}
              </span>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
