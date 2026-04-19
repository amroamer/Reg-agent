"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import EditorialAnswerCard from "@/components/search/EditorialAnswerCard";
import EditorialHeader from "@/components/search/EditorialHeader";
import EditorialResultGroup from "@/components/search/EditorialResultGroup";
import FilterSidebar from "@/components/search/FilterSidebar";
import { useSearch } from "@/hooks/useSearch";
import type { SearchResultItem } from "@/lib/types";

interface GroupedResult {
  document_id: string;
  document_title: string;
  document_number: string | null;
  source: string;
  doc_type?: string | null;
  date?: string | null;
  matches: SearchResultItem[];
  top_score: number;
}

function groupBySource(results: SearchResultItem[]): Record<string, GroupedResult[]> {
  const byDoc: Record<string, GroupedResult> = {};
  for (const r of results) {
    const key = r.document_id || `unknown-${Math.random()}`;
    if (!byDoc[key]) {
      byDoc[key] = {
        document_id: key,
        document_title:
          r.document_title_en || r.document_title_ar || "Untitled Document",
        document_number: r.document_number,
        source: r.source || "UNKNOWN",
        date: r.issue_date,
        matches: [],
        top_score: 0,
      };
    }
    byDoc[key].matches.push(r);
    byDoc[key].top_score = Math.max(byDoc[key].top_score, r.score || 0);
  }

  // Group by source authority
  const bySource: Record<string, GroupedResult[]> = {};
  for (const g of Object.values(byDoc)) {
    if (!bySource[g.source]) bySource[g.source] = [];
    bySource[g.source].push(g);
  }
  // Sort each source by top score
  for (const src of Object.keys(bySource)) {
    bySource[src].sort((a, b) => b.top_score - a.top_score);
  }
  return bySource;
}

export default function EditorialSearchPage() {
  const searchParams = useSearchParams();
  const { results, loading, search } = useSearch();

  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);

  // ─── Filters ───
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [language, setLanguage] = useState<"en" | "ar" | "both">("both");

  // Kick off initial search
  useEffect(() => {
    if (initialQuery) {
      search({ query: initialQuery, generate_answer: true });
      setSubmittedQuery(initialQuery);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (q: string) => {
    const sources = Array.from(selectedSources);
    search({ query: q, sources, generate_answer: true });
    setSubmittedQuery(q);
    const params = new URLSearchParams({ q });
    if (sources.length > 0) params.set("sources", sources.join(","));
    window.history.replaceState({}, "", `/search?${params}`);
  };

  // ─── Group results by source ───
  const grouped = useMemo(() => {
    if (!results?.results) return {};
    return groupBySource(results.results);
  }, [results]);

  // ─── Build filter buckets (counts) ───
  const sourceBuckets = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of results?.results || []) {
      const s = r.source || "UNKNOWN";
      counts[s] = (counts[s] || 0) + 1;
    }
    return [
      {
        key: "SAMA",
        label: "SAMA",
        count: counts.SAMA || 0,
        color: "#1E2A52",
      },
      { key: "CMA", label: "CMA", count: counts.CMA || 0, color: "#7C3AED" },
      {
        key: "BANK_POLICY",
        label: "Bank Internal",
        count: counts.BANK_POLICY || 0,
        color: "#D97706",
      },
    ];
  }, [results]);

  // Document type and topic buckets — placeholder for now
  const docTypeBuckets = [
    { key: "law", label: "Law", count: 0 },
    { key: "rule", label: "Rule / Regulation", count: 0 },
    { key: "circular", label: "Circular", count: 0 },
    { key: "guideline", label: "Guideline", count: 0 },
    { key: "internal", label: "Internal policy", count: 0 },
  ];
  const topicBuckets = [
    { key: "customer-protection", label: "Customer protection", count: 0 },
    { key: "credit-products", label: "Credit products", count: 0 },
    { key: "governance", label: "Governance", count: 0 },
    { key: "aml-cft", label: "AML / CFT", count: 0 },
    { key: "reporting", label: "Reporting", count: 0 },
  ];

  const handleDateQuick = (preset: "30d" | "year" | "3y" | "all") => {
    const now = new Date();
    const year = now.getFullYear();
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "year") {
      setDateFrom(String(year));
      setDateTo(String(year));
    } else if (preset === "3y") {
      setDateFrom(String(year - 3));
      setDateTo(String(year));
    } else {
      setDateFrom("");
      setDateTo(String(year));
    }
  };

  const removePill = (type: "source" | "doctype" | "year", key: string) => {
    if (type === "source") {
      const next = new Set(selectedSources);
      next.delete(key);
      setSelectedSources(next);
    } else if (type === "doctype") {
      const next = new Set(selectedDocTypes);
      next.delete(key);
      setSelectedDocTypes(next);
    } else if (type === "year") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const clearAll = () => {
    setSelectedSources(new Set());
    setSelectedDocTypes(new Set());
    setSelectedTopics(new Set());
    setDateFrom("");
    setDateTo("");
  };

  const activePills: Array<{ type: "source" | "doctype" | "year"; key: string; label: string }> = [];
  selectedSources.forEach((s) =>
    activePills.push({ type: "source", key: s, label: `Source: ${s}` }),
  );
  selectedDocTypes.forEach((t) =>
    activePills.push({ type: "doctype", key: t, label: `Type: ${t}` }),
  );
  if (dateFrom || dateTo)
    activePills.push({
      type: "year",
      key: "year",
      label: `Year: ${dateFrom || "…"}-${dateTo || "…"}`,
    });

  const totalDocs = useMemo(
    () => Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0),
    [grouped],
  );
  const uniqueSources = Object.keys(grouped).length;

  // Total hits (sum of all matches across all docs)
  const totalHits = results?.results.length || 0;

  return (
    <div className="min-h-screen bg-paper">
      <EditorialHeader
        query={query}
        onQueryChange={setQuery}
        onSubmit={handleSubmit}
      />

      <div className="max-w-[1400px] mx-auto flex">
        <FilterSidebar
          queryLabel={submittedQuery}
          hits={totalHits}
          timeMs={results?.metadata?.response_time_ms || 0}
          cached={results?.metadata?.from_cache}
          sources={sourceBuckets}
          selectedSources={selectedSources}
          onToggleSource={(s) => {
            const n = new Set(selectedSources);
            if (n.has(s)) n.delete(s);
            else n.add(s);
            setSelectedSources(n);
          }}
          onClearSources={() => setSelectedSources(new Set())}
          docTypes={docTypeBuckets}
          selectedDocTypes={selectedDocTypes}
          onToggleDocType={(t) => {
            const n = new Set(selectedDocTypes);
            if (n.has(t)) n.delete(t);
            else n.add(t);
            setSelectedDocTypes(n);
          }}
          onClearDocTypes={() => setSelectedDocTypes(new Set())}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
          onDateQuick={handleDateQuick}
          language={language}
          onLanguage={setLanguage}
          topics={topicBuckets}
          selectedTopics={selectedTopics}
          onToggleTopic={(t) => {
            const n = new Set(selectedTopics);
            if (n.has(t)) n.delete(t);
            else n.add(t);
            setSelectedTopics(n);
          }}
          onClearTopics={() => setSelectedTopics(new Set())}
        />

        {/* Main content */}
        <main className="flex-1 border-s border-paper-line min-h-[calc(100vh-56px)] px-8 py-6">
          {submittedQuery ? (
            <>
              {/* Results header */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-[22px] font-semibold text-ink leading-tight">
                  Results for{" "}
                  <span className="bg-mark px-2 py-0.5 rounded">
                    {submittedQuery}
                  </span>
                </h1>
                <div className="flex-shrink-0">
                  <select className="text-xs text-ink border border-paper-line rounded-lg px-3 py-1.5 bg-white hover:bg-paper-soft focus:outline-none focus:border-ink-soft">
                    <option>Sort: Relevance</option>
                    <option>Sort: Date (newest)</option>
                    <option>Sort: Date (oldest)</option>
                  </select>
                </div>
              </div>

              <p className="text-[12px] text-ink-muted mb-5">
                {totalDocs} document{totalDocs !== 1 ? "s" : ""} ·{" "}
                {results?.metadata?.response_time_ms || 0}ms · across{" "}
                {uniqueSources} source{uniqueSources !== 1 ? "s" : ""}
                {results?.metadata?.from_cache && (
                  <>
                    <span className="mx-1">·</span>
                    <span className="text-green-600">● cached</span>
                  </>
                )}
              </p>

              {/* Active filter pills */}
              {activePills.length > 0 && (
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  {activePills.map((p) => (
                    <button
                      key={`${p.type}-${p.key}`}
                      onClick={() => removePill(p.type, p.key)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-ink bg-paper-soft border border-paper-line rounded-full hover:border-ink-soft"
                    >
                      {p.label}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                  <button
                    onClick={clearAll}
                    className="text-[11px] text-ink-muted hover:text-ink"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* AI summary */}
              {results?.answer && results.answer.text && (
                <EditorialAnswerCard
                  answer={results.answer}
                  samaRegs={results.sama_regulations}
                  cmaRegs={results.cma_regulations}
                  bankPols={results.bank_policies}
                />
              )}

              {/* Loading */}
              {loading && (
                <div className="py-20 text-center text-ink-muted text-sm">
                  Searching...
                </div>
              )}

              {/* Grouped results */}
              {!loading && totalDocs === 0 && (
                <div className="py-20 text-center text-ink-muted text-sm">
                  No results found. Try different keywords or clear filters.
                </div>
              )}

              {!loading && (
                <>
                  {grouped.SAMA && (
                    <EditorialResultGroup
                      sourceLabel="SAMA Regulations"
                      sourceKey="SAMA"
                      count={grouped.SAMA.length}
                      groups={grouped.SAMA}
                      queryTerm={submittedQuery}
                    />
                  )}
                  {grouped.CMA && (
                    <EditorialResultGroup
                      sourceLabel="CMA Regulations"
                      sourceKey="CMA"
                      count={grouped.CMA.length}
                      groups={grouped.CMA}
                      queryTerm={submittedQuery}
                    />
                  )}
                  {grouped.BANK_POLICY && (
                    <EditorialResultGroup
                      sourceLabel="Bank Internal"
                      sourceKey="BANK_POLICY"
                      count={grouped.BANK_POLICY.length}
                      groups={grouped.BANK_POLICY}
                      queryTerm={submittedQuery}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-ink-muted">
              <p className="text-sm">Enter a query to search regulations.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
