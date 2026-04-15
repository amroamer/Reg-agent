"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string, sources: string[]) => void;
  loading?: boolean;
  initialQuery?: string;
}

const SOURCE_OPTIONS = [
  { value: "", label: { en: "All", ar: "الكل" } },
  { value: "SAMA", label: { en: "SAMA", ar: "ساما" } },
  { value: "CMA", label: { en: "CMA", ar: "هيئة السوق" } },
  { value: "BANK_POLICY", label: { en: "Bank Policies", ar: "سياسات البنك" } },
];

export default function SearchBar({
  onSearch,
  loading = false,
  initialQuery = "",
}: SearchBarProps) {
  const { language } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [activeSource, setActiveSource] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const sources = activeSource ? [activeSource] : [];
    onSearch(query, sources);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            language === "ar"
              ? "ابحث في الأنظمة واللوائح..."
              : "Search regulations..."
          }
          className="w-full ps-12 pe-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-kpmg-blue focus:outline-none transition shadow-sm hover:shadow-md"
          dir="auto"
        />
        {loading && (
          <Loader2 className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-kpmg-blue animate-spin" />
        )}
      </div>

      {/* Source Filters */}
      <div className="flex items-center gap-2 mt-3 justify-center flex-wrap">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActiveSource(opt.value)}
            className={`px-3 py-1 text-sm rounded-full font-medium transition ${
              activeSource === opt.value
                ? "bg-kpmg-blue text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label[language]}
          </button>
        ))}
      </div>
    </form>
  );
}
