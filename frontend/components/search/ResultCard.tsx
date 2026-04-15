"use client";

import { useLanguage } from "@/hooks/useLanguage";
import type { SearchResultItem } from "@/lib/types";
import SourceBadge from "./SourceBadge";
import { FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ResultCardProps {
  result: SearchResultItem;
}

export default function ResultCard({ result }: ResultCardProps) {
  const { language, isArabic } = useLanguage();

  const title =
    (isArabic ? result.document_title_ar : result.document_title_en) ||
    result.document_title_en ||
    result.document_title_ar ||
    "Untitled Document";

  const content =
    (isArabic ? result.content_ar : result.content_en) ||
    result.content_en ||
    result.content_ar ||
    "";

  // Truncate content
  const maxLen = 250;
  const snippet =
    content.length > maxLen ? content.slice(0, maxLen) + "..." : content;

  const scorePercent = Math.round(result.score * 100);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {result.source && (
            <SourceBadge source={result.source} language={language as "en" | "ar"} />
          )}
        </div>
        {result.document_number && (
          <span className="text-xs font-mono text-gray-500">
            {result.document_number}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="font-medium text-gray-900 mb-1 leading-snug">
        <Link
          href={`/documents/${result.document_id}`}
          className="hover:text-kpmg-blue transition"
        >
          {title}
        </Link>
      </h4>

      {/* Article Reference */}
      {result.article_number && (
        <p className="text-xs text-kpmg-blue font-medium mb-2">
          {result.article_number}
          {result.page_number && (
            <span className="text-gray-400 ms-2">p. {result.page_number}</span>
          )}
        </p>
      )}

      {/* Content Snippet */}
      <p
        className="text-sm text-gray-600 leading-relaxed"
        dir={isArabic ? "rtl" : "ltr"}
      >
        {snippet}
      </p>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Score bar */}
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-kpmg-blue rounded-full"
              style={{ width: `${Math.min(scorePercent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{scorePercent}%</span>
        </div>

        {result.source_url && (
          <a
            href={result.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-kpmg-blue hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {isArabic ? "عرض الأصل" : "View Original"}
          </a>
        )}
      </div>
    </div>
  );
}
