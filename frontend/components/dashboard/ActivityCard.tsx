"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import type { DashboardActivity } from "@/lib/types";

const ICON_GLYPH: Record<string, string> = {
  upload: "↑",
  reindex: "↻",
  fail: "!",
  search: "?",
};

export default function ActivityCard({ data }: { data: DashboardActivity[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <RotateCw size={12} />
          </span>
          Recent activity
        </div>
        <Link href="/admin/library" className="card-action">
          View all →
        </Link>
      </div>
      <div className="activity-list">
        {data.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-4)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            No activity yet.
          </p>
        )}
        {data.map((a, i) => (
          <div className="activity-item" key={i}>
            <div className={`activity-icon ${a.kind}`}>
              {ICON_GLYPH[a.kind] || "•"}
            </div>
            <div>
              {/* `what` may include <em>doc title</em> from backend — render as HTML */}
              <div
                className="activity-title"
                dangerouslySetInnerHTML={{
                  __html: `<em>${a.who}</em> ${a.what}`,
                }}
              />
              <div className="activity-sub">
                {a.src && <span>{a.src}</span>}
                {a.detail && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{a.detail}</span>
                  </>
                )}
              </div>
            </div>
            <span className="activity-time">{a.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
