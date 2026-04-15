"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSearch } from "@/hooks/useSearch";
import { useLanguage } from "@/hooks/useLanguage";
import Header from "@/components/layout/Header";
import SearchBar from "@/components/search/SearchBar";
import AnswerCard from "@/components/search/AnswerCard";
import ResultCard from "@/components/search/ResultCard";
import { Clock, Database } from "lucide-react";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const { results, loading, error, search } = useSearch();
  const { t, language } = useLanguage();
  const [hasSearched, setHasSearched] = useState(false);

  const initialQuery = searchParams.get("q") || "";

  useEffect(() => {
    if (initialQuery) {
      const sources = searchParams.get("sources")?.split(",").filter(Boolean) || [];
      search({ query: initialQuery, sources, generate_answer: true });
      setHasSearched(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (query: string, sources: string[]) => {
    search({ query, sources, generate_answer: true });
    setHasSearched(true);
    // Update URL
    const params = new URLSearchParams({ q: query });
    if (sources.length) params.set("sources", sources.join(","));
    window.history.replaceState({}, "", `/search?${params}`);
  };

  // Split results by source
  const samaResults =
    results?.results.filter((r) => r.source === "SAMA") || [];
  const cmaResults =
    results?.results.filter((r) => r.source === "CMA") || [];
  const bankResults =
    results?.results.filter((r) => r.source === "BANK_POLICY") || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-8">
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            initialQuery={initialQuery}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && results && (
          <>
            {/* Metadata Bar */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                {results.results.length} {t("resultsFound")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {results.metadata.response_time_ms}ms
              </span>
              {results.metadata.from_cache && (
                <span className="px-2 py-0.5 bg-gray-100 rounded-full">
                  {t("fromCache")}
                </span>
              )}
            </div>

            {/* AI Answer */}
            {results.answer && results.answer.text && (
              <div className="mb-8">
                <AnswerCard answer={results.answer} />
              </div>
            )}

            {/* Three-Column Results */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SAMA Column */}
              <div>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-sama">
                  <span className="font-semibold text-sama">
                    {language === "ar" ? "أنظمة ساما" : "SAMA Regulations"}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({samaResults.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {samaResults.map((r, i) => (
                    <ResultCard key={i} result={r} />
                  ))}
                  {samaResults.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                      {t("noResults")}
                    </p>
                  )}
                </div>
              </div>

              {/* CMA Column */}
              <div>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-cma">
                  <span className="font-semibold text-cma">
                    {language === "ar"
                      ? "أنظمة هيئة السوق المالية"
                      : "CMA Regulations"}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({cmaResults.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {cmaResults.map((r, i) => (
                    <ResultCard key={i} result={r} />
                  ))}
                  {cmaResults.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                      {t("noResults")}
                    </p>
                  )}
                </div>
              </div>

              {/* Bank Policy Column */}
              <div>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-bank">
                  <span className="font-semibold text-bank">
                    {language === "ar" ? "سياسات البنك" : "Bank Policies"}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({bankResults.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {bankResults.map((r, i) => (
                    <ResultCard key={i} result={r} />
                  ))}
                  {bankResults.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                      {t("noResults")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Cross-References */}
            {results.cross_references.length > 0 && (
              <div className="mt-8 p-6 bg-white border border-gray-200 rounded-xl">
                <h3 className="font-semibold text-gray-800 mb-4">
                  {language === "ar" ? "المراجع التبادلية" : "Cross-References"}
                </h3>
                <div className="space-y-3">
                  {results.cross_references.map((ref, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="font-medium text-gray-700">
                        {ref.from_document}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
                        {ref.relationship}
                      </span>
                      <span className="font-medium text-gray-700">
                        {ref.to_document}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
