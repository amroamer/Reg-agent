"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import Header from "@/components/layout/Header";
import SourceBadge from "@/components/search/SourceBadge";
import api from "@/lib/api";
import type { DocumentDetail } from "@/lib/types";
import { ArrowLeft, Calendar, FileText, Hash, Layers, Loader2 } from "lucide-react";
import Link from "next/link";

export default function DocumentDetailPage() {
  const params = useParams();
  const { language, isArabic } = useLanguage();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDoc() {
      try {
        const { data } = await api.get<DocumentDetail>(
          `/documents/${params.id}`,
        );
        setDoc(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-kpmg-blue" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-500">Document not found</p>
        </div>
      </div>
    );
  }

  const title =
    (isArabic ? doc.title_ar : doc.title_en) || doc.title_en || doc.title_ar;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/documents"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-kpmg-blue mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {isArabic ? "العودة إلى المكتبة" : "Back to Library"}
        </Link>

        {/* Document Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
              {doc.document_number && (
                <p className="text-sm font-mono text-gray-500">
                  {doc.document_number}
                </p>
              )}
            </div>
            <SourceBadge
              source={doc.source}
              language={language as "en" | "ar"}
              size="md"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>
                {doc.issue_date
                  ? new Date(doc.issue_date).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="w-4 h-4 text-gray-400" />
              <span>{doc.page_count ?? 0} pages</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Layers className="w-4 h-4 text-gray-400" />
              <span>{doc.chunks_count} chunks</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Hash className="w-4 h-4 text-gray-400" />
              <span>{doc.language || "bilingual"}</span>
            </div>
          </div>
        </div>

        {/* Chunks */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {isArabic ? "أجزاء المستند" : "Document Chunks"} ({doc.chunks_count})
        </h2>

        <div className="space-y-3">
          {doc.chunks.map((chunk) => (
            <div
              key={chunk.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                {chunk.article_number && (
                  <span className="text-sm font-semibold text-kpmg-blue">
                    {chunk.article_number}
                  </span>
                )}
                {chunk.section_title && (
                  <span className="text-xs text-gray-500 truncate">
                    {chunk.section_title}
                  </span>
                )}
                <span className="ms-auto text-xs text-gray-400">
                  p. {chunk.page_number ?? "?"} | {chunk.token_count ?? 0} tokens
                </span>
              </div>
              <p
                className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                dir={isArabic ? "rtl" : "ltr"}
              >
                {(isArabic ? chunk.content_ar : chunk.content_en) ||
                  chunk.content_en ||
                  chunk.content_ar ||
                  ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
