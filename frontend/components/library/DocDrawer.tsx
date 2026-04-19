"use client";

import { Download, Eye, FileText, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { Document } from "@/lib/types";
import SourceBadge from "./SourceBadge";
import StatusPill from "./StatusPill";

interface DocDrawerProps {
  doc: Document | null;
  onEdit: (doc: Document) => void;
  onReprocess: (doc: Document) => void;
}

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function DocDrawer({ doc, onEdit, onReprocess }: DocDrawerProps) {
  if (!doc) {
    return (
      <div
        className="dl-drawer"
        style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}
      >
        <div style={{ padding: "40px 10px" }}>
          <FileText size={28} />
          <p style={{ marginTop: 10 }}>
            Select a document to inspect its metadata and extracted content.
          </p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDoc = doc as any;
  const user = anyDoc.uploaded_by_name || anyDoc.uploaded_by || "—";
  const version = anyDoc.version ?? "v1";
  const reindexedAt = anyDoc.reindexed_at ?? anyDoc.updated_at;
  const preview: string | null = anyDoc.first_paragraph ?? null;

  return (
    <div className="dl-drawer">
      <div style={{ marginBottom: 8 }}>
        <SourceBadge source={doc.source} />
      </div>
      <h3>{doc.title_en || doc.title_ar || "Untitled"}</h3>
      {doc.document_number && (
        <div className="drawer-code">{doc.document_number}</div>
      )}
      <StatusPill status={doc.status} />

      <div className="dl-drawer-section">
        <h4>Metadata</h4>
        <dl className="dl-drawer-kv">
          <dt>Language</dt>
          <dd>{doc.language ?? "—"}</dd>
          <dt>Version</dt>
          <dd>{version}</dd>
          <dt>Uploaded</dt>
          <dd>
            {fmtDate(doc.created_at)} {user !== "—" ? `by ${user}` : ""}
          </dd>
          <dt>Re-indexed</dt>
          <dd>{fmtDate(reindexedAt)}</dd>
        </dl>
      </div>

      <div className="dl-drawer-section">
        <h4>Extracted content</h4>
        <dl className="dl-drawer-kv">
          <dt>Pages</dt>
          <dd>{doc.page_count ?? "—"}</dd>
          <dt>Articles</dt>
          <dd>{doc.total_articles ?? "—"}</dd>
          <dt>Chunks (RAG)</dt>
          <dd>{doc.total_chunks ?? "—"}</dd>
        </dl>
      </div>

      {preview && (
        <div className="dl-drawer-section">
          <h4>First paragraph</h4>
          <div className="dl-drawer-preview">{preview}</div>
        </div>
      )}

      {doc.error_message && (
        <div className="dl-drawer-section">
          <h4 style={{ color: "#b42818" }}>Error</h4>
          <div
            style={{
              fontSize: 12.5,
              color: "#7A2412",
              padding: "8px 10px",
              background: "#FEF4F1",
              border: "1px solid #F3CABE",
              borderRadius: 6,
            }}
          >
            {doc.error_message}
          </div>
        </div>
      )}

      <div
        className="dl-drawer-section"
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
      >
        <Link href={`/admin/library/${doc.id}`} className="btn primary">
          <Eye size={12} />
          Preview
        </Link>
        <button className="btn" onClick={() => onEdit(doc)}>
          <Pencil size={12} />
          Edit metadata
        </button>
        <button className="btn" onClick={() => onReprocess(doc)}>
          <RefreshCw size={12} />
          Re-index
        </button>
        <a
          href={`/api/documents/${doc.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          <Download size={12} />
          Download
        </a>
      </div>
    </div>
  );
}
