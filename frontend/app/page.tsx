"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Building2,
  FileText,
  Lock,
  Scale,
  Search,
  Shield,
} from "lucide-react";
import EditorialHeader from "@/components/search/EditorialHeader";

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
  const [query, setQuery] = useState("");

  const handleSearch = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleTopicClick = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <EditorialHeader query={query} onQueryChange={setQuery} onSubmit={handleSearch} />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl w-full text-center">
          <div className="mb-8">
            <p className="text-[11px] font-semibold text-ink-muted tracking-[0.15em] uppercase mb-4">
              Regulatory Intelligence · Saudi Arabia
            </p>
            <h1 className="text-5xl font-semibold text-ink mb-3 tracking-tight">
              RegInspector
            </h1>
            <p className="text-base text-ink-muted">
              Search SAMA and CMA regulations and internal bank policies.
              <br />
              <span className="font-arabic">منصة الذكاء التنظيمي للبنوك السعودية</span>
            </p>
          </div>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) handleSearch(query);
            }}
            className="mb-10"
          >
            <div className="relative flex items-center bg-white rounded-xl border border-paper-line focus-within:border-ink-soft shadow-sm">
              <Search className="w-5 h-5 text-ink-muted ms-4 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search regulations, articles, policies..."
                className="flex-1 px-3 py-4 text-base text-ink bg-transparent focus:outline-none"
                dir="auto"
                autoFocus
              />
              <kbd className="me-3 px-2 py-1 text-[11px] font-mono text-ink-muted bg-paper-soft border border-paper-line rounded">
                ⌘K
              </kbd>
            </div>
          </form>

          {/* Topic quick access */}
          <div>
            <p className="text-[11px] font-semibold text-ink-muted tracking-[0.12em] uppercase mb-4">
              Popular topics
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TOPICS.map((topic) => (
                <button
                  key={topic.en}
                  onClick={() => handleTopicClick(topic.query)}
                  className="p-4 bg-white rounded-lg border border-paper-line hover:border-ink-soft hover:shadow-sm transition text-start group"
                >
                  <topic.icon className="w-5 h-5 text-ink-soft mb-2" />
                  <p className="text-sm font-medium text-ink">{topic.en}</p>
                  <p className="text-xs text-ink-muted font-arabic mt-1">
                    {topic.ar}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-paper-line bg-white/60">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between text-[11px] text-ink-muted">
          <span>RegInspector v1.0.0 · Beta</span>
          <span>KPMG Saudi Arabia</span>
        </div>
      </footer>
    </div>
  );
}
