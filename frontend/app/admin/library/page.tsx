"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import DeleteConfirmModal from "@/components/documents/DeleteConfirmModal";
import EditMetadataModal from "@/components/documents/EditMetadataModal";
import StatusBadge from "@/components/documents/StatusBadge";
import SourceBadge from "@/components/search/SourceBadge";
import api from "@/lib/api";
import type { Document, DocumentListResponse } from "@/lib/types";

export default function AdminLibraryPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (sourceFilter) params.source = sourceFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get<DocumentListResponse>("/documents", {
        params,
      });
      let filtered = data.documents;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            (d.title_en || "").toLowerCase().includes(q) ||
            (d.title_ar || "").toLowerCase().includes(q) ||
            (d.document_number || "").toLowerCase().includes(q),
        );
      }
      setDocs(filtered);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, statusFilter, search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRetry = async (id: string) => {
    try {
      await api.post(`/documents/${id}/retry`);
      setMenuOpenId(null);
      fetchDocs();
    } catch (e) {
      alert("Retry failed");
    }
  };

  const handleReprocess = async (id: string) => {
    if (!confirm("Re-process this document? Old chunks and vectors will be deleted first.")) return;
    try {
      await api.post(`/documents/${id}/reprocess`);
      setMenuOpenId(null);
      fetchDocs();
    } catch (e) {
      alert("Reprocess failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    await api.delete(`/documents/${deleteDoc.id}`);
    fetchDocs();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} document{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/bulk-upload"
            className="flex items-center gap-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Link>
          <Link
            href="/admin/upload"
            className="flex items-center gap-1 px-4 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark"
          >
            <Plus className="w-4 h-4" />
            Upload New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or document number..."
            className="w-full ps-10 pe-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
        >
          <option value="">All Sources</option>
          <option value="SAMA">SAMA</option>
          <option value="CMA">CMA</option>
          <option value="BANK_POLICY">Bank Policy</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
        >
          <option value="">All Statuses</option>
          <option value="indexed">Active</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-kpmg-blue" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2" />
            <p>No documents found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-3 text-start">Source</th>
                <th className="px-4 py-3 text-start">Document</th>
                <th className="px-4 py-3 text-start">Number</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Pages</th>
                <th className="px-4 py-3 text-end">Uploaded</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <SourceBadge source={doc.source} language="en" />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/library/${doc.id}`}
                      className="hover:text-kpmg-blue"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {doc.title_en || doc.title_ar || "Untitled"}
                      </p>
                      {doc.title_ar && doc.title_en && (
                        <p className="text-xs text-gray-500 font-arabic">
                          {doc.title_ar}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-600">
                      {doc.document_number || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                    {doc.status === "failed" && doc.error_message && (
                      <p className="text-xs text-red-600 mt-1 truncate max-w-xs">
                        {doc.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end text-sm text-gray-500">
                    {doc.page_count ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-end text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() =>
                        setMenuOpenId(menuOpenId === doc.id ? null : doc.id)
                      }
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {menuOpenId === doc.id && (
                      <div
                        ref={menuRef}
                        className="absolute end-2 top-10 z-20 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                      >
                        <button
                          onClick={() => router.push(`/admin/library/${doc.id}`)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4" /> View Details
                        </button>
                        <button
                          onClick={() => {
                            setEditDoc(doc);
                            setMenuOpenId(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                        >
                          <Edit className="w-4 h-4" /> Edit Metadata
                        </button>
                        <a
                          href={`/api/documents/${doc.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <FileText className="w-4 h-4" /> View PDF
                        </a>
                        <a
                          href={`/api/documents/${doc.id}/markdown`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <Download className="w-4 h-4" /> Download Markdown
                        </a>
                        <a
                          href={`/api/documents/${doc.id}/json`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <Download className="w-4 h-4" /> Download JSON
                        </a>
                        <div className="border-t border-gray-100 my-1" />
                        {doc.status === "failed" ? (
                          <button
                            onClick={() => handleRetry(doc.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                          >
                            <RotateCw className="w-4 h-4" /> Retry
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReprocess(doc.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                          >
                            <RefreshCw className="w-4 h-4" /> Re-process
                          </button>
                        )}
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            setDeleteDoc(doc);
                            setMenuOpenId(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <EditMetadataModal
        open={!!editDoc}
        doc={editDoc}
        onClose={() => setEditDoc(null)}
        onSaved={fetchDocs}
      />
      <DeleteConfirmModal
        open={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleDelete}
        documentTitle={deleteDoc?.title_en || deleteDoc?.title_ar || "Untitled"}
        documentNumber={deleteDoc?.document_number || "-"}
        stats={{ pages: deleteDoc?.page_count || 0, articles: 0, chunks: 0 }}
      />
    </div>
  );
}
