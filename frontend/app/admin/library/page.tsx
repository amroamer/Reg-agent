"use client";

import { Plus, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import BulkUploadModal from "@/components/documents/BulkUploadModal";
import DeleteConfirmModal from "@/components/documents/DeleteConfirmModal";
import EditMetadataModal from "@/components/documents/EditMetadataModal";
import UploadSlideOver from "@/components/documents/UploadSlideOver";
import BulkActionBar from "@/components/library/BulkActionBar";
import DocDrawer from "@/components/library/DocDrawer";
import DocGrid from "@/components/library/DocGrid";
import DocTable from "@/components/library/DocTable";
import FailedBanner from "@/components/library/FailedBanner";
import LibrarySidebar from "@/components/library/LibrarySidebar";
import LibraryToolbar, { type ViewMode } from "@/components/library/LibraryToolbar";
import { useProcessingPoll } from "@/hooks/useProcessingPoll";
import { useToast } from "@/hooks/useToast";
import api from "@/lib/api";
import type { Document, DocumentListResponse, LibraryStats } from "@/lib/types";

export default function DocumentLibraryPage() {
  const toast = useToast();

  // Query / sort / view
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<string>("created_at:desc");
  const [view, setView] = useState<ViewMode>("table");
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

  // Selection + drawer
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerDoc, setDrawerDoc] = useState<Document | null>(null);

  // Modals
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // ─── Debounced search ───
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Fetch ───
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [sortBy, sortOrder] = sort.split(":");
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (selectedSources.size > 0)
        params.source = Array.from(selectedSources).join(",");
      if (selectedStatuses.size > 0)
        params.status = Array.from(selectedStatuses).join(",");
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
  }, [page, pageSize, sort, selectedSources, selectedStatuses, debouncedSearch, toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // ─── Poll processing/pending ───
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

  // ─── Client-side type filter (backend doesn't support 'type' yet) ───
  const filteredDocs = useMemo(() => {
    if (selectedTypes.size === 0) return docs;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return docs.filter((d: any) => {
      const t = (d.document_type || "").toString();
      return t && selectedTypes.has(t);
    });
  }, [docs, selectedTypes]);

  const failedDocs = docs.filter(
    (d) => (d.status as string)?.toLowerCase?.() === "failed",
  );

  const toggle = (set: Set<string>, val: string) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return next;
  };

  // ─── Handlers ───
  const handleRetry = async (doc: Document) => {
    try {
      await api.post(`/documents/${doc.id}/retry`);
      toast.notify("info", "Retry started", doc.title_en || "Document");
      fetchDocs();
    } catch {
      toast.notify("error", "Retry failed");
    }
  };

  const handleReprocess = async (doc: Document) => {
    if (
      !confirm(
        `Re-process "${doc.title_en || doc.title_ar || "this document"}"?\n\nOld chunks and vectors will be deleted first.`,
      )
    )
      return;
    try {
      await api.post(`/documents/${doc.id}/reprocess`);
      toast.notify("info", "Re-processing started", doc.title_en || "Document");
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
      setDeleteDoc(null);
    } catch {
      toast.notify("error", "Delete failed");
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { data } = await api.post("/documents/bulk-delete", {
        document_ids: Array.from(selected),
        confirm: true,
      });
      toast.notify("success", `Deleted ${data.deleted} documents`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      fetchDocs();
    } catch {
      toast.notify("error", "Bulk delete failed");
    }
  };

  const exportCSV = () => {
    const rows = Array.from(selected).map((id) => docs.find((d) => d.id === id)).filter(Boolean);
    const header = "id,title_en,title_ar,source,document_number,status,page_count,total_articles,total_chunks,created_at";
    const body = rows
      .map((d) => {
        if (!d) return "";
        const esc = (v: unknown) =>
          `"${String(v ?? "").replace(/"/g, '""')}"`;
        return [
          esc(d.id),
          esc(d.title_en),
          esc(d.title_ar),
          esc(d.source),
          esc(d.document_number),
          esc(d.status),
          esc(d.page_count),
          esc(d.total_articles),
          esc(d.total_chunks),
          esc(d.created_at),
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([header + "\n" + body], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reg-inspector-documents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ─── Render ───
  return (
    <div className="dl-shell">
      <LibrarySidebar stats={stats} />

      <div className="dl-content">
        <div className="dl-head">
          <div>
            <h1>Document Library</h1>
            <p>
              Manage all regulatory documents, bank policies, and their{" "}
              <a href="#">metadata</a>. Uploaded files are OCR&apos;d and
              indexed automatically.
            </p>
          </div>
          <div className="dl-head-actions">
            <button className="btn" onClick={() => setBulkUploadOpen(true)}>
              <Upload size={13} />
              Bulk upload
            </button>
            <button className="btn primary" onClick={() => setUploadOpen(true)}>
              <Plus size={13} />
              Upload
            </button>
          </div>
        </div>

        <FailedBanner
          failedDocs={failedDocs}
          onRetryAll={() => failedDocs.forEach((d) => handleRetry(d))}
          onViewFailed={() => {
            setSelectedStatuses(new Set(["failed"]));
            setPage(1);
          }}
        />

        <LibraryToolbar
          query={search}
          onQuery={(q) => {
            setSearch(q);
            setPage(1);
          }}
          view={view}
          onView={setView}
          sources={selectedSources}
          onToggleSource={(s) => {
            setSelectedSources(toggle(selectedSources, s));
            setPage(1);
          }}
          statuses={selectedStatuses}
          onToggleStatus={(s) => {
            setSelectedStatuses(toggle(selectedStatuses, s));
            setPage(1);
          }}
          types={selectedTypes}
          onToggleType={(t) => setSelectedTypes(toggle(selectedTypes, t))}
          sort={sort}
          onSort={setSort}
        />

        <div className="dl-count-row">
          <span>
            <b>{filteredDocs.length}</b> of {total} documents
          </span>
          <span style={{ color: "#1a7a4c" }}>● {stats.indexed} indexed</span>
          <span style={{ color: "#8f5a0a" }}>● {stats.processing} processing</span>
          <span style={{ color: "var(--ink-4)" }}>● {stats.pending} pending</span>
          <span style={{ color: "#b42818" }}>● {stats.failed} failed</span>
        </div>

        <BulkActionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onReindex={() => {
            const sel = Array.from(selected);
            Promise.all(
              sel.map((id) =>
                api.post(`/documents/${id}/reprocess`).catch(() => null),
              ),
            ).then(() => {
              toast.notify("info", `Re-indexing ${sel.length} documents`);
              setSelected(new Set());
              fetchDocs();
            });
          }}
          onExport={exportCSV}
          onDelete={() => setBulkDeleteOpen(true)}
        />

        {/* ─── Content ─── */}
        {loading ? (
          <div
            style={{
              padding: "80px 0",
              textAlign: "center",
              color: "var(--ink-4)",
              fontSize: 13,
            }}
          >
            Loading documents…
          </div>
        ) : filteredDocs.length === 0 ? (
          <div
            className="dl-table-wrap"
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "var(--ink-3)",
            }}
          >
            <Search
              size={32}
              style={{ color: "var(--ink-4)", margin: "0 auto 10px" }}
            />
            <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
              No documents match your filters.
            </p>
            {(search ||
              selectedSources.size > 0 ||
              selectedStatuses.size > 0 ||
              selectedTypes.size > 0) && (
              <button
                className="btn sm"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setSearch("");
                  setSelectedSources(new Set());
                  setSelectedStatuses(new Set());
                  setSelectedTypes(new Set());
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <DocGrid docs={filteredDocs} />
        ) : view === "split" ? (
          <div className="dl-split">
            <DocTable
              docs={filteredDocs}
              selected={selected}
              setSelected={setSelected}
              view="dense"
              activeId={drawerDoc?.id}
              onRowClick={setDrawerDoc}
              onEdit={setEditDoc}
              onRetry={handleRetry}
              onReprocess={handleReprocess}
              onDelete={setDeleteDoc}
              sortBy={sort}
              onSort={(col) => {
                const [curCol, curDir] = sort.split(":");
                const nextDir = curCol === col && curDir === "desc" ? "asc" : "desc";
                setSort(`${col}:${nextDir}`);
              }}
            />
            <DocDrawer
              doc={drawerDoc}
              onEdit={setEditDoc}
              onReprocess={handleReprocess}
            />
          </div>
        ) : (
          <DocTable
            docs={filteredDocs}
            selected={selected}
            setSelected={setSelected}
            view={view}
            onEdit={setEditDoc}
            onRetry={handleRetry}
            onReprocess={handleReprocess}
            onDelete={setDeleteDoc}
            sortBy={sort}
            onSort={(col) => {
              const [curCol, curDir] = sort.split(":");
              const nextDir = curCol === col && curDir === "desc" ? "asc" : "desc";
              setSort(`${col}:${nextDir}`);
            }}
          />
        )}

        <div className="dl-foot">
          <span>
            Showing {filteredDocs.length === 0 ? 0 : (page - 1) * pageSize + 1}
            –{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="dl-page-btns">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  className={page === pageNum ? "active" : ""}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ─── Modals (reused from existing document components) ─── */}
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16,18,22,0.42)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            zIndex: 200,
          }}
          onClick={() => setBulkDeleteOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-elev)",
              borderRadius: 14,
              boxShadow: "var(--sh-lg)",
              width: 480,
              maxWidth: "calc(100vw - 40px)",
              padding: 22,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.01em" }}>
              Delete {selected.size} document
              {selected.size !== 1 ? "s" : ""}?
            </h2>
            <p
              style={{
                color: "var(--ink-3)",
                fontSize: 13,
                margin: "12px 0 18px",
              }}
            >
              You are about to permanently delete {selected.size} document
              {selected.size !== 1 ? "s" : ""}. Their chunks, vectors, and
              extracted files will also be removed. This cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button className="btn" onClick={() => setBulkDeleteOpen(false)}>
                Cancel
              </button>
              <button className="btn primary danger" onClick={handleBulkDelete}>
                Delete {selected.size} document
                {selected.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadSlideOver
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCompleted={() => {
          fetchDocs();
          toast.notify("success", "Document uploaded successfully");
        }}
      />
      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onCompleted={() => fetchDocs()}
      />
    </div>
  );
}
