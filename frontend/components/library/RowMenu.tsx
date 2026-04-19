"use client";

import {
  Copy,
  Download,
  Eye,
  Pencil,
  RefreshCw,
  Replace,
  RotateCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Document } from "@/lib/types";

interface RowMenuProps {
  doc: Document;
  onClose: () => void;
  onEdit: (doc: Document) => void;
  onRetry: (doc: Document) => void;
  onReprocess: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}

export default function RowMenu({
  doc,
  onClose,
  onEdit,
  onRetry,
  onReprocess,
  onDelete,
}: RowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const copyLink = () => {
    const url = `${window.location.origin}/admin/library/${doc.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    onClose();
  };

  const statusLower = (doc.status as string)?.toLowerCase?.();

  return (
    <div className="dropdown" ref={ref} style={{ right: 0, top: "100%", marginTop: 4 }}>
      <Link href={`/admin/library/${doc.id}`} className="dropdown-item">
        <Eye size={13} />
        Preview document
      </Link>
      <button className="dropdown-item" onClick={() => onEdit(doc)}>
        <Pencil size={13} />
        Edit metadata
      </button>
      {statusLower === "indexed" && (
        <button className="dropdown-item" onClick={() => onReprocess(doc)}>
          <RefreshCw size={13} />
          Re-index
        </button>
      )}
      {statusLower === "failed" && (
        <button className="dropdown-item" onClick={() => onRetry(doc)}>
          <RotateCw size={13} />
          Retry
        </button>
      )}
      <div className="dropdown-sep" />
      <a
        href={`/api/documents/${doc.id}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="dropdown-item"
      >
        <Download size={13} />
        Download original
      </a>
      <a
        href={`/api/documents/${doc.id}/markdown`}
        target="_blank"
        rel="noopener noreferrer"
        className="dropdown-item"
      >
        <Replace size={13} />
        Download markdown
      </a>
      <button className="dropdown-item" onClick={copyLink}>
        <Copy size={13} />
        Copy internal link
      </button>
      <div className="dropdown-sep" />
      <button className="dropdown-item danger" onClick={() => onDelete(doc)}>
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  );
}
