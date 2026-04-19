"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Link2,
} from "lucide-react";
import { useState } from "react";
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

interface EditorialResultGroupProps {
  sourceLabel: string; // e.g. "SAMA Regulations"
  sourceKey: string; // "SAMA" | "CMA" | "BANK_POLICY"
  count: number;
  groups: GroupedResult[];
  queryTerm: string;
}

const SOURCE_COLORS: Record<string, string> = {
  SAMA: "#1E2A52",
  CMA: "#7C3AED",
  BANK_POLICY: "#059669",
};

function highlightTerm(text: string, term: string): React.ReactNode[] {
  if (!term.trim()) return [text];
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="bg-mark px-0.5 rounded-sm font-medium text-ink">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// Strip the retrieval context header "[SOURCE | Doc | Article N: Title]\n\n"
// that the backend chunker embeds at the start of each chunk. Defensive in
// case the backend ships a pre-fix response (e.g. from cache).
const HEADER_RE = /^\s*\[[^\]\n]{1,400}\]\s*\n*/;
function stripHeader(text: string): string {
  return text.replace(HEADER_RE, "").replace(/^\s+/, "");
}

function formatArticleLabel(n: string | null | undefined): string | null {
  if (!n) return null;
  const trimmed = String(n).trim();
  if (!trimmed) return null;
  // If it already starts with a word (Article/المادة/etc.) leave it alone,
  // otherwise prefix with "Article".
  if (/^[A-Za-z\u0600-\u06FF]/.test(trimmed)) return trimmed;
  return `Article ${trimmed}`;
}

const PREVIEW_CHARS = 320;

/** Render text with paragraph breaks preserved + query term highlighted. */
function renderParagraphs(text: string, term: string): React.ReactNode {
  // Split on blank lines to preserve paragraph breaks; collapse single newlines
  // inside paragraphs (numbered lists, etc. stay on their own line).
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((p, pi) => {
    // Keep single-newline structure (e.g. numbered lists) by splitting per line.
    const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean);
    return (
      <p key={pi} className={pi > 0 ? "mt-3" : undefined}>
        {lines.map((line, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {highlightTerm(line, term)}
          </span>
        ))}
      </p>
    );
  });
}

function MatchRow({
  match,
  queryTerm,
  defaultExpanded = false,
}: {
  match: SearchResultItem;
  queryTerm: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const rawContent = match.content_en || match.content_ar || "";
  const content = stripHeader(rawContent);
  const canTruncate = content.length > PREVIEW_CHARS;
  const showFull = expanded || !canTruncate;

  const articleLabel = formatArticleLabel(match.article_number);
  // Prefer explicit article title, then section title, then chapter title
  const subTitle =
    match.article_title_en ||
    match.article_title_ar ||
    match.section_title ||
    match.chapter_title_en ||
    match.chapter_title_ar ||
    null;

  const hasMeta = Boolean(articleLabel || subTitle || match.page_number);
  const previewSnippet = canTruncate ? content.slice(0, PREVIEW_CHARS) : content;

  return (
    <div className="pt-4">
      {hasMeta && (
        <p className="text-[12px] font-mono text-ink-muted mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {articleLabel && (
            <span className="text-ink font-semibold">{articleLabel}</span>
          )}
          {subTitle && (
            <>
              {articleLabel && <span className="text-ink-muted">·</span>}
              <span className="text-ink-soft">§ {subTitle}</span>
            </>
          )}
          {match.page_number && (
            <>
              {(articleLabel || subTitle) && <span className="text-ink-muted">·</span>}
              <span>p.{match.page_number}</span>
            </>
          )}
        </p>
      )}

      {showFull ? (
        <div
          className="text-[14px] leading-relaxed text-ink space-y-0"
          dir="auto"
        >
          <span className="text-ink-muted me-1">&ldquo;</span>
          {renderParagraphs(content, queryTerm)}
          <span className="text-ink-muted ms-1">&rdquo;</span>
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed text-ink" dir="auto">
          &ldquo;{highlightTerm(previewSnippet, queryTerm)}…&rdquo;
        </p>
      )}

      {canTruncate && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-soft hover:text-ink font-medium"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show full text ({content.length.toLocaleString()} chars)
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-muted">
        <Link
          href={`/admin/library/${match.document_id}`}
          className="flex items-center gap-1 hover:text-ink"
        >
          <ExternalLink className="w-3 h-3" />
          Open in context
        </Link>
        <button
          onClick={() => {
            const cite = [match.document_number, articleLabel, subTitle]
              .filter(Boolean)
              .join(" · ");
            navigator.clipboard.writeText(cite);
          }}
          className="flex items-center gap-1 hover:text-ink"
        >
          <Copy className="w-3 h-3" />
          Copy citation
        </button>
        <button
          onClick={() => {
            const url = `${window.location.origin}/admin/library/${match.document_id}`;
            navigator.clipboard.writeText(url);
          }}
          className="flex items-center gap-1 hover:text-ink"
        >
          <Link2 className="w-3 h-3" />
          Share link
        </button>
      </div>
    </div>
  );
}

export default function EditorialResultGroup({
  sourceLabel,
  sourceKey,
  count,
  groups,
  queryTerm,
}: EditorialResultGroupProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  if (groups.length === 0) return null;

  const dotColor = SOURCE_COLORS[sourceKey] || "#666";

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2 h-2 rounded-sm"
          style={{ background: dotColor }}
        />
        <h2 className="text-[11px] font-semibold text-ink tracking-[0.12em] uppercase">
          {sourceLabel} · {count} documents
        </h2>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const totalMatches = group.matches.length;
          const showCount = expandedDocs.has(group.document_id) ? totalMatches : Math.min(2, totalMatches);
          const hiddenCount = totalMatches - showCount;
          const scorePercent = Math.round(group.top_score * 100);

          return (
            <article
              key={group.document_id}
              className="bg-white rounded-xl border border-paper-line p-5 hover:shadow-sm transition"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/library/${group.document_id}`}
                    className="text-[17px] font-semibold text-ink hover:text-ink-soft leading-tight block"
                  >
                    {group.document_title}
                  </Link>
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border"
                      style={{
                        background: `${dotColor}15`,
                        color: dotColor,
                        borderColor: `${dotColor}30`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-sm" style={{ background: dotColor }} />
                      {sourceKey === "BANK_POLICY" ? "Bank Policy" : sourceKey}
                    </span>
                    {group.doc_type && (
                      <span className="text-ink-muted">{group.doc_type}</span>
                    )}
                    {group.document_number && (
                      <span className="font-mono text-ink-muted">
                        {group.document_number}
                      </span>
                    )}
                    {group.date && (
                      <span className="text-ink-muted">{group.date}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px] text-ink-muted">
                    {totalMatches} match{totalMatches !== 1 ? "es" : ""}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-paper-line rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ink-soft rounded-full"
                        style={{ width: `${scorePercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-muted font-mono">
                      {scorePercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Matches */}
              <div className="divide-y divide-paper-line">
                {group.matches.slice(0, showCount).map((m, i) => (
                  <MatchRow key={i} match={m} queryTerm={queryTerm} />
                ))}
              </div>

              {/* Show more */}
              {hiddenCount > 0 && (
                <button
                  onClick={() => {
                    const next = new Set(expandedDocs);
                    if (next.has(group.document_id)) {
                      next.delete(group.document_id);
                    } else {
                      next.add(group.document_id);
                    }
                    setExpandedDocs(next);
                  }}
                  className="flex items-center gap-1 mt-4 pt-4 border-t border-paper-line w-full text-[12px] text-ink-muted hover:text-ink"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Show {hiddenCount} more match{hiddenCount !== 1 ? "es" : ""} in this document
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
