"use client";

import { Download, Pencil, RotateCw, Trash2 } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onReindex?: () => void;
  onTag?: () => void;
  onExport?: () => void;
  onDelete: () => void;
}

export default function BulkActionBar({
  count,
  onClear,
  onReindex,
  onTag,
  onExport,
  onDelete,
}: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <div className="dl-bulk">
      <div className="dl-bulk-count">{count} selected</div>
      <button
        onClick={onClear}
        style={{
          fontSize: 12,
          color: "var(--primary)",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Clear
      </button>
      <div className="dl-bulk-actions">
        {onReindex && (
          <button className="btn sm" onClick={onReindex}>
            <RotateCw size={11} />
            Re-index
          </button>
        )}
        {onTag && (
          <button className="btn sm" onClick={onTag}>
            <Pencil size={11} />
            Tag
          </button>
        )}
        {onExport && (
          <button className="btn sm" onClick={onExport}>
            <Download size={11} />
            Export CSV
          </button>
        )}
        <button className="btn sm danger" onClick={onDelete}>
          <Trash2 size={11} />
          Delete
        </button>
      </div>
    </div>
  );
}
