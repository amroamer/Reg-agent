"use client";

import {
  Columns2,
  Grid3x3,
  LayoutList,
  List,
  Search,
} from "lucide-react";

export type ViewMode = "table" | "dense" | "grid" | "split";

const SOURCE_SWATCH: Record<string, string> = {
  SAMA: "var(--sama)",
  CMA: "var(--cma)",
  BANK_POLICY: "var(--bank)",
};

const SOURCE_LABELS: Record<string, string> = {
  SAMA: "SAMA",
  CMA: "CMA",
  BANK_POLICY: "Bank Policy",
};

const STATUS_LABELS: Record<string, string> = {
  indexed: "Indexed",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
};

const TYPE_OPTIONS = ["Law", "Rule", "Circular", "Guideline", "Policy"];

interface LibraryToolbarProps {
  query: string;
  onQuery: (q: string) => void;

  view: ViewMode;
  onView: (v: ViewMode) => void;

  sources: Set<string>;
  onToggleSource: (s: string) => void;

  statuses: Set<string>;
  onToggleStatus: (s: string) => void;

  types: Set<string>;
  onToggleType: (t: string) => void;

  sort: string;
  onSort: (s: string) => void;
}

export default function LibraryToolbar({
  query,
  onQuery,
  view,
  onView,
  sources,
  onToggleSource,
  statuses,
  onToggleStatus,
  types,
  onToggleType,
  sort,
  onSort,
}: LibraryToolbarProps) {
  return (
    <div className="dl-toolbar">
      {/* Row 1 — search + view toggle */}
      <div className="dl-tb-row">
        <div className="dl-search">
          <Search size={14} color="var(--ink-3)" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search title, document number, or metadata…"
          />
        </div>
        <div className="dl-view-toggle" role="tablist" aria-label="View mode">
          <button
            className={view === "table" ? "active" : ""}
            onClick={() => onView("table")}
            title="Table"
            aria-label="Table view"
          >
            <List size={14} />
          </button>
          <button
            className={view === "dense" ? "active" : ""}
            onClick={() => onView("dense")}
            title="Dense"
            aria-label="Dense view"
          >
            <LayoutList size={14} />
          </button>
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => onView("grid")}
            title="Grid"
            aria-label="Grid view"
          >
            <Grid3x3 size={14} />
          </button>
          <button
            className={view === "split" ? "active" : ""}
            onClick={() => onView("split")}
            title="Split"
            aria-label="Split view"
          >
            <Columns2 size={14} />
          </button>
        </div>
      </div>

      {/* Row 2 — filter chips + sort */}
      <div className="dl-tb-row">
        <span className="dl-filter-label">Source</span>
        {(["SAMA", "CMA", "BANK_POLICY"] as const).map((s) => (
          <button
            key={s}
            className={`filter-chip ${sources.has(s) ? "active" : ""}`}
            onClick={() => onToggleSource(s)}
          >
            <span
              className="swatch"
              style={{ background: SOURCE_SWATCH[s] }}
            />
            {SOURCE_LABELS[s]}
          </button>
        ))}

        <div className="dl-filter-sep" />
        <span className="dl-filter-label">Status</span>
        {(["indexed", "processing", "pending", "failed"] as const).map((s) => (
          <button
            key={s}
            className={`filter-chip ${statuses.has(s) ? "active" : ""}`}
            onClick={() => onToggleStatus(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}

        <div className="dl-filter-sep" />
        <span className="dl-filter-label">Type</span>
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            className={`filter-chip ${types.has(t) ? "active" : ""}`}
            onClick={() => onToggleType(t)}
          >
            {t}
          </button>
        ))}

        <select
          className="dl-sort-select"
          style={{ marginLeft: "auto" }}
          value={sort}
          onChange={(e) => onSort(e.target.value)}
        >
          <option value="created_at:desc">Upload date (newest)</option>
          <option value="created_at:asc">Upload date (oldest)</option>
          <option value="title_en:asc">Title (A–Z)</option>
          <option value="title_en:desc">Title (Z–A)</option>
          <option value="page_count:desc">Page count</option>
          <option value="status:asc">Status</option>
        </select>
      </div>
    </div>
  );
}
