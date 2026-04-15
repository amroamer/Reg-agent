"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import Header from "@/components/layout/Header";
import SourceBadge from "@/components/search/SourceBadge";
import api from "@/lib/api";
import type { Document, DocumentListResponse } from "@/lib/types";
import { FileText, Calendar, Layers, Loader2 } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  indexed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  superseded: "bg-gray-100 text-gray-500",
};

export default function DocumentsPage() {
  const { language, t } = useLanguage();
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (sourceFilter) params.source = sourceFilter;
      const { data } = await api.get<DocumentListResponse>("/documents", {
        params,
      });
      setDocs(data.documents);
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("documentLibrary")}
          </h1>
          <span className="text-sm text-gray-500">
            {total} {t("documents").toLowerCase()}
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {["", "SAMA", "CMA", "BANK_POLICY"].map((src) => (
            <button
              key={src}
              onClick={() => {
                setSourceFilter(src);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                sourceFilter === src
                  ? "bg-kpmg-blue text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {src || (language === "ar" ? "الكل" : "All")}
            </button>
          ))}
        </div>

        {/* Documents Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-kpmg-blue" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-start">{t("documents")}</th>
                  <th className="px-4 py-3 text-start">{t("source")}</th>
                  <th className="px-4 py-3 text-start">{t("status")}</th>
                  <th className="px-4 py-3 text-end">{t("pages")}</th>
                  <th className="px-4 py-3 text-end">{t("uploadedOn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="flex items-center gap-2 hover:text-kpmg-blue"
                      >
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {(language === "ar"
                              ? doc.title_ar
                              : doc.title_en) ||
                              doc.title_en ||
                              doc.title_ar}
                          </p>
                          {doc.document_number && (
                            <p className="text-xs text-gray-400 font-mono">
                              {doc.document_number}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge
                        source={doc.source}
                        language={language as "en" | "ar"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status] || ""}`}
                      >
                        {t(doc.status as keyof typeof t extends never ? "pending" : any)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-sm text-gray-500">
                      {doc.page_count ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-end text-sm text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {docs.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <Layers className="w-8 h-8 mx-auto mb-2" />
                <p>{t("noResults")}</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("back")}
            </button>
            <span className="text-sm text-gray-500">
              {page} / {Math.ceil(total / 20)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
