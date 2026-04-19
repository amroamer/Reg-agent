"use client";

import Link from "next/link";
import type { Document } from "@/lib/types";
import StatusPill from "./StatusPill";
import SourceBadge from "./SourceBadge";

interface DocGridProps {
  docs: Document[];
}

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

export default function DocGrid({ docs }: DocGridProps) {
  return (
    <div className="dl-grid">
      {docs.map((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyDoc = d as any;
        const user = anyDoc.uploaded_by_name || anyDoc.uploaded_by || "Ahmad Mansour";
        return (
          <Link
            key={d.id}
            href={`/admin/library/${d.id}`}
            className="dl-card"
            style={{ textDecoration: "none" }}
          >
            <div className="dl-card-head">
              <div style={{ minWidth: 0 }}>
                <h3 className="dl-card-title">
                  {d.title_en || d.title_ar || "Untitled"}
                </h3>
                {d.document_number && (
                  <div className="dl-card-code">{d.document_number}</div>
                )}
              </div>
              <SourceBadge source={d.source} />
            </div>
            <StatusPill status={d.status} />
            <div className="dl-card-stats">
              <div className="dl-card-stat">
                <b>{d.page_count ?? "—"}</b>
                <span className="label">pages</span>
              </div>
              <div className="dl-card-stat">
                <b>{d.total_articles ?? "—"}</b>
                <span className="label">articles</span>
              </div>
              <div className="dl-card-stat">
                <b>{d.total_chunks ?? "—"}</b>
                <span className="label">chunks</span>
              </div>
            </div>
            <div className="dl-card-foot">
              <div className="dl-user">
                <div className="avatar">{initials(user)}</div>
                <span>{user.split(" ")[0]}</span>
              </div>
              <span>{fmtDate(d.created_at)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
