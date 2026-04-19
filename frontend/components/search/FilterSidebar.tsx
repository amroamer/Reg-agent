"use client";

interface Bucket {
  key: string;
  label: string;
  count: number;
  color?: string;
}

interface FilterSidebarProps {
  queryLabel: string;
  hits: number;
  timeMs: number;
  cached?: boolean;

  sources: Bucket[];
  selectedSources: Set<string>;
  onToggleSource: (s: string) => void;
  onClearSources: () => void;

  docTypes: Bucket[];
  selectedDocTypes: Set<string>;
  onToggleDocType: (t: string) => void;
  onClearDocTypes: () => void;

  dateFrom: string;
  dateTo: string;
  onDateRange: (from: string, to: string) => void;
  onDateQuick: (preset: "30d" | "year" | "3y" | "all") => void;

  language: "en" | "ar" | "both";
  onLanguage: (l: "en" | "ar" | "both") => void;

  topics: Bucket[];
  selectedTopics: Set<string>;
  onToggleTopic: (t: string) => void;
  onClearTopics: () => void;
}

function SectionHeader({
  label,
  onClear,
}: {
  label: string;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-semibold text-ink-muted tracking-[0.08em] uppercase">
        {label}
      </span>
      {onClear && (
        <button
          onClick={onClear}
          className="text-[10px] text-ink-muted hover:text-ink"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  count,
  dotColor,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
  dotColor?: string;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-paper-tan text-ink-soft focus:ring-ink-soft"
      />
      {dotColor && (
        <span
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ background: dotColor }}
        />
      )}
      <span className="text-sm text-ink flex-1 group-hover:text-ink-soft">
        {label}
      </span>
      <span className="text-xs text-ink-muted">{count}</span>
    </label>
  );
}

export default function FilterSidebar(props: FilterSidebarProps) {
  const {
    queryLabel,
    hits,
    timeMs,
    cached,
    sources,
    selectedSources,
    onToggleSource,
    onClearSources,
    docTypes,
    selectedDocTypes,
    onToggleDocType,
    onClearDocTypes,
    dateFrom,
    dateTo,
    onDateRange,
    onDateQuick,
    language,
    onLanguage,
    topics,
    selectedTopics,
    onToggleTopic,
    onClearTopics,
  } = props;

  return (
    <aside className="w-60 flex-shrink-0 py-6 px-5 text-sm">
      {/* Query header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-ink-muted tracking-wide">
          Results for{" "}
          <span className="text-ink">&quot;{queryLabel}&quot;</span>
        </p>
        <p className="mt-1 text-[11px] text-ink-muted flex items-center gap-2">
          <span>📄 {hits} hits</span>
          <span>·</span>
          <span>⏱ {timeMs}ms</span>
          {cached && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">⚡ cached</span>
            </>
          )}
        </p>
      </div>

      {/* Source */}
      <div className="mb-5 pb-5 border-b border-paper-line">
        <SectionHeader
          label="Source"
          onClear={selectedSources.size > 0 ? onClearSources : undefined}
        />
        <div className="space-y-0.5">
          {sources.map((s) => (
            <CheckboxRow
              key={s.key}
              checked={selectedSources.has(s.key)}
              onChange={() => onToggleSource(s.key)}
              label={s.label}
              count={s.count}
              dotColor={s.color}
            />
          ))}
        </div>
      </div>

      {/* Document Type */}
      <div className="mb-5 pb-5 border-b border-paper-line">
        <SectionHeader
          label="Document Type"
          onClear={selectedDocTypes.size > 0 ? onClearDocTypes : undefined}
        />
        <div className="space-y-0.5">
          {docTypes.map((d) => (
            <CheckboxRow
              key={d.key}
              checked={selectedDocTypes.has(d.key)}
              onChange={() => onToggleDocType(d.key)}
              label={d.label}
              count={d.count}
            />
          ))}
        </div>
      </div>

      {/* Date published */}
      <div className="mb-5 pb-5 border-b border-paper-line">
        <SectionHeader label="Date Published" />
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={dateFrom}
            onChange={(e) => onDateRange(e.target.value, dateTo)}
            placeholder="2020"
            className="w-full px-2 py-1 text-xs text-ink bg-white border border-paper-line rounded focus:border-ink-soft focus:outline-none"
          />
          <input
            type="text"
            value={dateTo}
            onChange={(e) => onDateRange(dateFrom, e.target.value)}
            placeholder="2026"
            className="w-full px-2 py-1 text-xs text-ink bg-white border border-paper-line rounded focus:border-ink-soft focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            ["30d", "Last 30d"],
            ["year", "This year"],
            ["3y", "Last 3y"],
            ["all", "All"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => onDateQuick(key as "30d" | "year" | "3y" | "all")}
              className="px-2 py-0.5 text-[11px] text-ink-muted hover:text-ink bg-white border border-paper-line rounded"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="mb-5 pb-5 border-b border-paper-line">
        <SectionHeader label="Language" />
        <div className="space-y-1">
          {[
            ["en", "English"],
            ["ar", "العربية"],
            ["both", "Both"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 py-0.5 cursor-pointer"
            >
              <input
                type="radio"
                name="language"
                checked={language === key}
                onChange={() => onLanguage(key as "en" | "ar" | "both")}
                className="w-3.5 h-3.5 border-paper-tan text-ink-soft"
              />
              <span className={key === "ar" ? "text-sm font-arabic text-ink" : "text-sm text-ink"}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div>
        <SectionHeader
          label="Topic"
          onClear={selectedTopics.size > 0 ? onClearTopics : undefined}
        />
        <div className="space-y-0.5">
          {topics.map((t) => (
            <CheckboxRow
              key={t.key}
              checked={selectedTopics.has(t.key)}
              onChange={() => onToggleTopic(t.key)}
              label={t.label}
              count={t.count}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
