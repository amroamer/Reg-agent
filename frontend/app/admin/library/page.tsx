"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowDownUp,
  Download,
  Edit,
  Eye,
  FileText,
  Grid3x3,
  List,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import DeleteConfirmModal from "@/components/documents/DeleteConfirmModal";
import EditMetadataModal from "@/components/documents/EditMetadataModal";
import StatusCell from "@/components/documents/StatusCell";
import SourceBadge from "@/components/search/SourceBadge";
import { useToast } from "@/hooks/useToast";
import { useProcessingPoll } from "@/hooks/useProcessingPoll";
import api from "@/lib/api";
import type {
  Document,
  DocumentListResponse,
  LibraryStats,
} from "@/lib/types";

type ViewMode = "list" | "grid";
type SortField =
  | "created_at"
  | "title_en"
  | "status"
  | "total_articles"
  | "page_count";
type SortOrder = "asc" | "desc";

const SOURCE_OPTIONS = ["SAMA", "CMA", "BANK_POLICY"] as const;
const STATUS_OPTIONS = ["indexed", "processing", "pending", "failed"] as const;

const STATUS_LABELS: Record<string, string> = {
  indexed: "Indexed",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
};

const SOURCE_LABELS: Record<string, string> = {
  SAMA: "SAMA",
  CMA: "CMA",
  BANK_POLICY: "Bank Policy",
};

export default function AdminLibraryPage() {
  const router = useRouter();
  const toast = useToast();

  // Filters & sort
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Data
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LibraryStats>({
    total: 0,
    indexed: 0,
    processing: 0,
    pending: 0,
    failed: 0,
    superseded: 0,
  });
  const [loading, setLoading] = useState(true);

  // UI state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch documents
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (selectedSources.size > 0) params.source = [...selectedSources].join(",");
      if (selectedStatuses.size > 0)
        params.status = [...selectedStatuses].join(",");
      if (debouncedSearch) params.search = debouncedSearch;

      const { data } = await api.get<DocumentListResponse>("/documents", {
        params,
      });
      setDocs(data.documents);
      setTotal(data.total);
      setStats(data.stats);
    } catch {
      toast.notify("error", "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortOrder,
    selectedSources,
    selectedStatuses,
    debouncedSearch,
    toast,
  ]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Poll for processing/pending docs
  const hasActive = stats.processing + stats.pending > 0;
  useProcessingPoll(hasActive, (updates) => {
    setDocs((prev) =>
      prev.map((d) => {
        const u = updates.find((x) => x.id === d.id);
        if (!u) return d;
        return {
          ...d,
          status: u.status as Document["status"],
          total_articles: u.total_articles ?? d.total_articles,
          total_chunks: u.total_chunks ?? d.total_chunks,
          error_message: u.error_message ?? d.error_message,
        };
      }),
    );
    const anyTransitioned = updates.some(
      (u) => u.status === "indexed" || u.status === "failed",
    );
    if (anyTransitioned) fetchDocs();
  });

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

  const toggleSource = (s: string) => {
    const next = new Set(selectedSources);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedSources(next);
    setPage(1);
  };

  const toggleStatus = (s: string) => {
    const next = new Set(selectedStatuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedStatuses(next);
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedSources(new Set());
    setSelectedStatuses(new Set());
    setSearch("");
    setPage(1);
  };

  const hasFilters =
    selectedSources.size > 0 ||
    selectedStatuses.size > 0 ||
    debouncedSearch.length > 0;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === docs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map((d) => d.id)));
    }
  };

  const handleRetry = async (doc: Document) => {
    try {
      await api.post(`/documents/${doc.id}/retry`);
      toast.notify("info", "Retry started", doc.title_en || "Document");
      setMenuOpenId(null);
      fetchDocs();
    } catch {
      toast.notify("error", "Retry failed");
    }
  };

  const handleReprocess = async (doc: Document) => {
    if (
      !confirm(
        `Re-process "${doc.title_en}"?\n\nOld chunks and vectors will be deleted first.`,
      )
    )
      return;
    try {
      await api.post(`/documents/${doc.id}/reprocess`);
      toast.notify("info", "Re-processing started", doc.title_en || "Document");
      setMenuOpenId(null);
      fetchDocs();
    } catch {
      toast.notify("error", "Re-process failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      await api.delete(`/documents/${deleteDoc.id}`);
      toast.notify("success", "Document deleted", deleteDoc.title_en || undefined);
      fetchDocs();
    } catch {
      toast.notify("error", "Delete failed");
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { data } = await api.post("/documents/bulk-delete", {
        document_ids: [...selectedIds],
        confirm: true,
      });
      toast.notify("success", `Deleted ${data.deleted} documents`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchDocs();
    } catch {
      toast.notify("error", "Bulk delete failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const renderEmpty = () => {
    if (hasFilters) {
      return (
        <div className="py-20 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">
            No documents match your search and filters
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 text-sm bg-kpmg-blue text-white rounded-lg hover:bg-kpmg-blue-dark"
          >
            Clear All Filters
          </button>
        </div>
      );
    }
    return (
      <div className="py-20 text-center">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No documents uploaded yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Upload SAMA regulations, CMA regulations, or bank policies to start.
        </p>
        <Link
          href="/admin/upload"
          className="inline-flex items-center gap-1 mt-4 px-4 py-2 text-sm bg-kpmg-blue text-white rounded-lg hover:bg-kpmg-blue-dark"
        >
          <Plus className="w-4 h-4" /> Upload Document
        </Link>
      </div>
    );
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all regulatory documents, bank policies, and their metadata.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/bulk-upload"
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" /> Bulk Upload
          </Link>
          <Link
            href="/admin/upload"
            className="flex items-center gap-1 px-4 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark"
          >
            <Plus className="w-4 h-4" /> Upload Document
          </Link>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search title or document number..."
            className="w-full ps-10 pe-9 py-2 text-sm border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center border border-gray-300 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={clsx(
              "p-1.5 rounded",
              viewMode === "list" ? "bg-kpmg-blue text-white" : "text-gray-500",
            )}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={clsx(
              "p-1.5 rounded",
              viewMode === "grid" ? "bg-kpmg-blue text-white" : "text-gray-500",
            )}
            title="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter pills + sort */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            Source:
          </span>
          {SOURCE_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded-full border transition",
                selectedSources.has(s)
                  ? s === "SAMA"
                    ? "bg-sama text-white border-sama"
                    : s === "CMA"
                      ? "bg-cma text-white border-cma"
                      : "bg-bank text-white border-bank"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            Status:
          </span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded-full border transition",
                selectedStatuses.has(s)
                  ? s === "indexed"
                    ? "bg-green-500 text-white border-green-500"
                    : s === "processing"
                      ? "bg-blue-500 text-white border-blue-500"
                      : s === "pending"
                        ? "bg-yellow-500 text-white border-yellow-500"
                        : "bg-red-500 text-white border-red-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-2">
          <ArrowDownUp className="w-4 h-4 text-gray-400" />
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [f, o] = e.target.value.split(":");
              setSortBy(f as SortField);
              setSortOrder(o as SortOrder);
            }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="created_at:desc">Upload Date (newest)</option>
            <option value="created_at:asc">Upload Date (oldest)</option>
            <option value="title_en:asc">Title A-Z</option>
            <option value="title_en:desc">Title Z-A</option>
            <option value="total_articles:desc">Most Articles</option>
            <option value="status:asc">Status</option>
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-kpmg-blue hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Stats line */}
      <div className="text-xs text-gray-500 mb-4 flex gap-4">
        <span>{stats.total} total</span>
        <span className="text-green-600">✓ {stats.indexed} indexed</span>
        {stats.processing > 0 && (
          <span className="text-blue-600">⏳ {stats.processing} processing</span>
        )}
        {stats.pending > 0 && (
          <span className="text-yellow-600">⏸ {stats.pending} pending</span>
        )}
        {stats.failed > 0 && (
          <span className="text-red-600">✗ {stats.failed} failed</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-kpmg-blue" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          {renderEmpty()}
        </div>
      ) : viewMode === "list" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === docs.length && docs.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-start">Document</th>
                <th className="px-4 py-3 text-start">Source</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-start">Content</th>
                <th className="px-4 py-3 text-end">Uploaded</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr
                  key={doc.id}
                  className={clsx(
                    "hover:bg-gray-50 transition",
                    selectedIds.has(doc.id) && "bg-blue-50/30",
                  )}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div
                      onClick={() => router.push(`/admin/library/${doc.id}`)}
                      className="cursor-pointer"
                    >
                      <p className="text-sm font-medium text-gray-900 hover:text-kpmg-blue">
                        {doc.title_en || "Untitled"}
                      </p>
                      {doc.title_ar && (
                        <p className="text-xs text-gray-500 font-arabic mt-0.5">
                          {doc.title_ar}
                        </p>
                      )}
                      {doc.document_number && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {doc.document_number}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge source={doc.source} language="en" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell doc={doc} onRetry={() => handleRetry(doc)} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {doc.status === "indexed" ? (
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div>{doc.page_count ?? 0} pages</div>
                        <div>{doc.total_articles ?? 0} articles</div>
                        <div>{doc.total_chunks ?? 0} chunks</div>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end text-xs text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-3 relative">
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
                          onClick={() =>
                            router.push(`/admin/library/${doc.id}`)
                          }
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4" /> View Details
                        </button>
                        {doc.status === "indexed" && (
                          <>
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
                              <Download className="w-4 h-4" /> Download MD
                            </a>
                            <a
                              href={`/api/documents/${doc.id}/json`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              <Download className="w-4 h-4" /> Download JSON
                            </a>
                          </>
                        )}
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            setEditDoc(doc);
                            setMenuOpenId(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                        >
                          <Edit className="w-4 h-4" /> Edit Metadata
                        </button>
                        {doc.status === "failed" ? (
                          <button
                            onClick={() => handleRetry(doc)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                          >
                            <RotateCw className="w-4 h-4" /> Retry
                          </button>
                        ) : doc.status === "indexed" ? (
                          <button
                            onClick={() => handleReprocess(doc)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start hover:bg-gray-50"
                          >
                            <RefreshCw className="w-4 h-4" /> Re-process
                          </button>
                        ) : null}
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
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={clsx(
                "bg-white rounded-xl border p-4 hover:shadow-md transition cursor-pointer",
                selectedIds.has(doc.id)
                  ? "border-kpmg-blue ring-2 ring-kpmg-blue/20"
                  : "border-gray-200",
              )}
              onClick={() => router.push(`/admin/library/${doc.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <SourceBadge source={doc.source} language="en" />
                <input
                  type="checkbox"
                  checked={selectedIds.has(doc.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(doc.id)}
                  className="rounded border-gray-300"
                />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                {doc.title_en || "Untitled"}
              </h3>
              {doc.title_ar && (
                <p className="text-xs text-gray-500 font-arabic line-clamp-1 mb-1">
                  {doc.title_ar}
                </p>
              )}
              {doc.document_number && (
                <p className="text-xs text-gray-400 font-mono mb-3">
                  {doc.document_number}
                </p>
              )}

              <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                <StatusCell doc={doc} onRetry={() => handleRetry(doc)} />
              </div>

              {doc.status === "indexed" && (
                <div className="flex gap-3 text-xs text-gray-500 pb-3 border-b border-gray-100">
                  <span>📄 {doc.page_count ?? 0}</span>
                  <span>📑 {doc.total_articles ?? 0}</span>
                  <span>🔗 {doc.total_chunks ?? 0}</span>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-6 text-sm">
          <span className="text-gray-500">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              ←
            </button>
            <span className="px-3 py-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="h-5 w-px bg-gray-300" />
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Modals */}
      <EditMetadataModal
        open={!!editDoc}
        doc={editDoc}
        onClose={() => setEditDoc(null)}
        onSaved={() => {
          toast.notify("success", "Metadata updated");
          fetchDocs();
        }}
      />
      <DeleteConfirmModal
        open={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleDelete}
        documentTitle={deleteDoc?.title_en || deleteDoc?.title_ar || "Untitled"}
        documentNumber={deleteDoc?.document_number || "-"}
        stats={{
          pages: deleteDoc?.page_count || 0,
          articles: deleteDoc?.total_articles || 0,
          chunks: deleteDoc?.total_chunks || 0,
        }}
      />

      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              Delete {selectedIds.size} Documents
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              You are about to permanently delete {selectedIds.size} documents.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete {selectedIds.size} Documents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
