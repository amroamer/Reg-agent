"use client";

import { ChevronDown, FileText, MoreVertical, RotateCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Document } from "@/lib/types";
import RowMenu from "./RowMenu";
import StatusPill from "./StatusPill";
import SourceBadge from "./SourceBadge";

type ViewMode = "table" | "dense" | "split";

interface DocTableProps {
  docs: Document[];
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  view: ViewMode;
  activeId?: string | null;
  onRowClick?: (doc: Document) => void;
  onEdit: (doc: Document) => void;
  onRetry: (doc: Document) => void;
  onReprocess: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  sortBy?: string;
  onSort?: (col: string) => void;
}

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// The backend /documents response doesn't (yet) carry these — keep a soft
// fallback so the UI degrades gracefully.
function docUser(doc: Document): { name: string; initials: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDoc = doc as any;
  const name = anyDoc.uploaded_by_name || anyDoc.uploaded_by || "Ahmad Mansour";
  return { name, initials: initials(name) };
}

export default function DocTable({
  docs,
  selected,
  setSelected,
  view,
  activeId,
  onRowClick,
  onEdit,
  onRetry,
  onReprocess,
  onDelete,
  sortBy,
  onSort,
}: DocTableProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const allChecked = docs.length > 0 && selected.size === docs.length;
  const someChecked = selected.size > 0 && selected.size < docs.length;

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(docs.map((d) => d.id)));
  };

  const dense = view === "dense" || view === "split";

  const headers = useMemo(
    () => [
      { key: "title_en", label: "Document", sortable: true, className: "active-sort" },
      { key: "source", label: "Source", sortable: false },
      { key: "type", label: "Type", sortable: false },
      { key: "status", label: "Status", sortable: true },
      { key: "content", label: "Content", sortable: false, align: "right" },
      { key: "language", label: "Lang", sortable: false },
      { key: "uploader", label: "Uploaded by", sortable: false },
      { key: "created_at", label: "Uploaded", sortable: true },
      { key: "reindexed", label: "Re-indexed", sortable: false },
      { key: "version", label: "Ver.", sortable: false },
    ],
    [],
  );

  return (
    <div className="dl-table-wrap">
      <table className={`dl-table ${dense ? "dense" : ""}`}>
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input
                className="dl-checkbox"
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
              />
            </th>
            {headers.map((h) => {
              const active = sortBy?.startsWith(h.key);
              return (
                <th
                  key={h.key}
                  className={`${h.sortable ? "sortable" : ""} ${active ? "active-sort" : ""}`}
                  style={h.align === "right" ? { textAlign: "right" } : undefined}
                  onClick={() => h.sortable && onSort?.(h.key)}
                >
                  {h.label}
                  {h.sortable && (
                    <ChevronDown
                      size={12}
                      className="sort-ico"
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginLeft: 4,
                        transform: sortBy === `${h.key}:asc` ? "rotate(180deg)" : undefined,
                      }}
                    />
                  )}
                </th>
              );
            })}
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const isSelected = selected.has(d.id);
            const isActive = activeId === d.id;
            const user = docUser(d);
            const statusLower = (d.status as string)?.toLowerCase?.() ?? "";
            // Optional extended fields the backend may add — read defensively.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyDoc = d as any;
            const docType = anyDoc.document_type ?? "—";
            const reindexedAt = anyDoc.reindexed_at ?? anyDoc.updated_at;
            const version = anyDoc.version ?? "v1";
            return (
              <tr
                key={d.id}
                className={`${isSelected || isActive ? "selected" : ""}`}
                onClick={() => onRowClick?.(d)}
                style={{ cursor: onRowClick ? "pointer" : undefined }}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    className="dl-checkbox"
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(d.id)}
                  />
                </td>
                <td className="dl-doc-cell">
                  <div className="dl-doc-title">
                    <FileText size={14} color="var(--ink-3)" />
                    <Link href={`/admin/library/${d.id}`} onClick={(e) => e.stopPropagation()}>
                      {d.title_en || d.title_ar || "Untitled"}
                    </Link>
                  </div>
                  {d.document_number && (
                    <div className="dl-doc-sub">{d.document_number}</div>
                  )}
                  {d.title_ar && d.title_en && (
                    <span className="dl-doc-alt" dir="rtl">
                      {d.title_ar}
                    </span>
                  )}
                </td>
                <td>
                  <SourceBadge source={d.source} />
                </td>
                <td style={{ fontSize: 12, color: "var(--ink-3)" }}>{docType}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusPill status={d.status} />
                    {statusLower === "failed" && (
                      <button
                        className="btn sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(d);
                        }}
                      >
                        <RotateCw size={11} />
                        Retry
                      </button>
                    )}
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  {statusLower === "indexed" ? (
                    <div
                      className="dl-content-cell"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <div>
                        <b>{d.page_count ?? "—"}</b>
                        <span className="label">pages</span>
                      </div>
                      <div>
                        <b>{d.total_articles ?? "—"}</b>
                        <span className="label">articles</span>
                      </div>
                      <div>
                        <b>{d.total_chunks ?? "—"}</b>
                        <span className="label">chunks</span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "var(--ink-4)", fontSize: 12 }}>—</span>
                  )}
                </td>
                <td>
                  <span className="dl-lang">{d.language ?? "—"}</span>
                </td>
                <td>
                  <div className="dl-user">
                    <div className="avatar">{user.initials}</div>
                    <span>{user.name.split(" ")[0]}</span>
                  </div>
                </td>
                <td>
                  <div className="dl-date">
                    {fmtDate(d.created_at)}
                    <small>{fmtTime(d.created_at)}</small>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {reindexedAt ? fmtDate(reindexedAt) : "—"}
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--ink-3)",
                      fontFamily: "JetBrains Mono, IBM Plex Mono, monospace",
                    }}
                  >
                    {version}
                  </span>
                </td>
                <td
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: "relative" }}
                >
                  <button
                    className="row-action"
                    onClick={() =>
                      setMenuFor(menuFor === d.id ? null : d.id)
                    }
                    aria-label="Row actions"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuFor === d.id && (
                    <RowMenu
                      doc={d}
                      onClose={() => setMenuFor(null)}
                      onEdit={onEdit}
                      onRetry={onRetry}
                      onReprocess={onReprocess}
                      onDelete={onDelete}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
