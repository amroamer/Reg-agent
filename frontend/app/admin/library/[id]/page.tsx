"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import DeleteConfirmModal from "@/components/documents/DeleteConfirmModal";
import EditMetadataModal from "@/components/documents/EditMetadataModal";
import StatusBadge from "@/components/documents/StatusBadge";
import SourceBadge from "@/components/search/SourceBadge";
import api from "@/lib/api";
import type {
  ArticlesResponse,
  DocumentDetail,
  IngestionLogResponse,
} from "@/lib/types";

type TabKey = "overview" | "articles" | "crossrefs" | "log";

export default function AdminDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [articles, setArticles] = useState<ArticlesResponse | null>(null);
  const [log, setLog] = useState<IngestionLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(),
  );
  const [selectedArticle, setSelectedArticle] = useState<{
    id: string;
    article_index: number;
    article_number: string | null;
    article_title_ar: string | null;
    article_title_en: string | null;
    content_ar: string | null;
    content_en: string | null;
    page_start: number | null;
    page_end: number | null;
  } | null>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const { data } = await api.get<DocumentDetail>(`/documents/${docId}`);
      setDoc(data);
    } catch {
      // handled by user
    }
  }, [docId]);

  const fetchArticles = useCallback(async () => {
    try {
      const { data } = await api.get<ArticlesResponse>(
        `/documents/${docId}/articles`,
      );
      setArticles(data);
    } catch {
      // handled
    }
  }, [docId]);

  const fetchLog = useCallback(async () => {
    try {
      const { data } = await api.get<IngestionLogResponse>(
        `/documents/${docId}/ingestion-log`,
      );
      setLog(data);
    } catch {
      // handled
    }
  }, [docId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchDoc(), fetchArticles(), fetchLog()]);
      setLoading(false);
    })();
  }, [fetchDoc, fetchArticles, fetchLog]);

  const handleReprocess = async () => {
    if (!confirm("Re-process this document? Old chunks and vectors will be deleted first.")) return;
    await api.post(`/documents/${docId}/reprocess`);
    fetchDoc();
    fetchLog();
  };

  const handleDelete = async () => {
    await api.delete(`/documents/${docId}`);
    router.push("/admin/library");
  };

  if (loading || !doc) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-kpmg-blue" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/library"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-kpmg-blue mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <SourceBadge source={doc.source} language="en" size="md" />
              <StatusBadge status={doc.status} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {doc.title_en || "Untitled"}
            </h1>
            {doc.title_ar && (
              <p className="text-lg font-arabic text-gray-600 mb-1">
                {doc.title_ar}
              </p>
            )}
            <p className="text-xs font-mono text-gray-500">
              {doc.document_number}
            </p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <a
              href={`/api/documents/${docId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg"
            >
              <FileText className="w-4 h-4" /> View PDF
            </a>
            <a
              href={`/api/documents/${docId}/markdown`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg"
            >
              <Download className="w-4 h-4" /> MD
            </a>
            <a
              href={`/api/documents/${docId}/json`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg"
            >
              <Download className="w-4 h-4" /> JSON
            </a>
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg"
            >
              <Edit className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-6 text-xs text-gray-500 pt-3 border-t border-gray-100">
          <span>
            Issued: {doc.issue_date || "N/A"} • Effective: {doc.effective_date || "N/A"}
          </span>
          <span>{doc.page_count ?? 0} pages</span>
          <span>{doc.total_articles ?? 0} articles</span>
          <span>{doc.total_chunks ?? 0} chunks</span>
          <span>Language: {doc.language || "-"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex gap-1">
        {(
          [
            ["overview", "Overview"],
            ["articles", `Articles (${doc.total_articles ?? 0})`],
            ["crossrefs", "Cross-References"],
            ["log", "Ingestion Log"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as TabKey)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
              tab === key
                ? "border-kpmg-blue text-kpmg-blue"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              ["Pages", doc.page_count ?? 0, "text-kpmg-blue"],
              ["Articles", doc.total_articles ?? 0, "text-kpmg-purple"],
              ["Chunks", doc.total_chunks ?? 0, "text-kpmg-teal"],
              ["Status", doc.status, "text-kpmg-green"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Metadata</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gray-500">Source URL</dt>
              <dd className="text-gray-900 truncate">
                {doc.source_url ? (
                  <a href={doc.source_url} target="_blank" rel="noopener noreferrer" className="text-kpmg-blue hover:underline">
                    {doc.source_url}
                  </a>
                ) : "-"}
              </dd>
              <dt className="text-gray-500">Uploaded</dt>
              <dd className="text-gray-900">
                {new Date(doc.created_at).toLocaleString()}
              </dd>
              <dt className="text-gray-500">Last Updated</dt>
              <dd className="text-gray-900">
                {new Date(doc.updated_at).toLocaleString()}
              </dd>
              <dt className="text-gray-500">Ingestion Completed</dt>
              <dd className="text-gray-900">
                {doc.ingestion_completed_at
                  ? new Date(doc.ingestion_completed_at).toLocaleString()
                  : "N/A"}
              </dd>
              <dt className="text-gray-500">Language</dt>
              <dd className="text-gray-900">{doc.language || "-"}</dd>
            </dl>
          </div>
        </div>
      )}

      {tab === "articles" && articles && (
        <div className="space-y-2">
          {articles.chapters.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              No articles extracted yet.
            </p>
          ) : (
            articles.chapters.map((ch, idx) => {
              const key = ch.chapter_number || `_${idx}`;
              const expanded = expandedChapters.has(key);
              return (
                <div
                  key={key}
                  className="bg-white rounded-lg border border-gray-200"
                >
                  <button
                    onClick={() => {
                      const next = new Set(expandedChapters);
                      if (expanded) next.delete(key);
                      else next.add(key);
                      setExpandedChapters(next);
                    }}
                    className="w-full flex items-center gap-2 p-4 hover:bg-gray-50 text-start"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {ch.chapter_number
                          ? `Chapter ${ch.chapter_number}: `
                          : ""}
                        {ch.chapter_title_en || ch.chapter_title_ar || "(untitled chapter)"}
                      </p>
                      {ch.chapter_title_ar && ch.chapter_title_en && (
                        <p className="text-xs text-gray-500 font-arabic">
                          {ch.chapter_title_ar}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {ch.articles.length} article{ch.articles.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {ch.articles.map((a) => (
                        <button
                          key={a.id}
                          onClick={async () => {
                            try {
                              const { data } = await api.get(
                                `/documents/${docId}/articles/${a.article_index}`,
                              );
                              setSelectedArticle(data);
                            } catch {
                              // silent
                            }
                          }}
                          className="w-full px-4 py-2 ps-10 text-sm text-start hover:bg-blue-50 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">
                              {a.article_number
                                ? `Article ${a.article_number}`
                                : "Article"}
                              {a.article_title_en && `: ${a.article_title_en}`}
                            </span>
                            <span className="text-xs text-gray-400">
                              pp. {a.page_start}–{a.page_end}
                            </span>
                          </div>
                          {a.article_title_ar && (
                            <p className="text-xs text-gray-500 font-arabic mt-0.5">
                              {a.article_title_ar}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "crossrefs" && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          Cross-reference management — view and approve AI-suggested links between this document and other regulations.
          <br />
          <span className="text-xs text-gray-400">
            (Currently available via{" "}
            <Link href="/admin/cross-references" className="text-kpmg-blue">
              the cross-references page
            </Link>
            )
          </span>
        </div>
      )}

      {tab === "log" && log && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Status: <StatusBadge status={log.document_status} />
              {log.total_duration_s != null && (
                <span className="ms-2">
                  Total: {log.total_duration_s.toFixed(1)}s
                </span>
              )}
            </p>
            <button
              onClick={handleReprocess}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> Re-process
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {log.stages.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                No stage data recorded yet.
              </p>
            ) : (
              log.stages.map((s, i) => (
                <div
                  key={s.stage}
                  className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0"
                >
                  {s.status === "completed" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : s.status === "failed" ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : s.status === "processing" ? (
                    <Loader2 className="w-5 h-5 text-kpmg-blue animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      Stage {i + 1}: {s.stage}
                    </p>
                  </div>
                  {s.duration_s != null && (
                    <span className="text-xs text-gray-500">
                      {s.duration_s.toFixed(1)}s
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {log.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h4 className="font-semibold text-red-700 mb-2">Errors</h4>
              <div className="space-y-2 text-xs">
                {log.errors.map((e, i) => (
                  <div key={i} className="bg-white rounded p-2">
                    <p className="font-medium text-red-600">Stage: {e.phase}</p>
                    <p className="text-red-800 font-mono text-[11px] mt-1">
                      {e.error_message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <EditMetadataModal
        open={showEdit}
        doc={doc}
        onClose={() => setShowEdit(false)}
        onSaved={fetchDoc}
      />
      <DeleteConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        documentTitle={doc.title_en || doc.title_ar || "Untitled"}
        documentNumber={doc.document_number || "-"}
        stats={{
          pages: doc.page_count ?? 0,
          articles: doc.total_articles ?? 0,
          chunks: doc.total_chunks ?? 0,
        }}
      />

      {/* Article viewer slide-over */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="absolute top-0 end-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between z-10">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">
                  Article {selectedArticle.article_number || selectedArticle.article_index + 1}
                  {selectedArticle.page_start && (
                    <span className="ms-2">
                      • pp. {selectedArticle.page_start}–{selectedArticle.page_end}
                    </span>
                  )}
                </p>
                {selectedArticle.article_title_en && (
                  <h3 className="font-semibold text-gray-900 mt-1">
                    {selectedArticle.article_title_en}
                  </h3>
                )}
                {selectedArticle.article_title_ar && (
                  <p className="text-sm font-arabic text-gray-600 mt-0.5">
                    {selectedArticle.article_title_ar}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-5">
              {selectedArticle.content_en && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    English
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {selectedArticle.content_en}
                  </p>
                </div>
              )}
              {selectedArticle.content_ar && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    العربية
                  </p>
                  <p
                    className="text-sm text-gray-800 font-arabic whitespace-pre-wrap leading-relaxed"
                    dir="rtl"
                  >
                    {selectedArticle.content_ar}
                  </p>
                </div>
              )}
              {!selectedArticle.content_en && !selectedArticle.content_ar && (
                <p className="text-sm text-gray-400 italic">
                  No content extracted for this article.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
