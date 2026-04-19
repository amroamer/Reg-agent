"use client";

import { TrendingUp } from "lucide-react";
import Link from "next/link";
import type { DashboardTopQuery } from "@/lib/types";

export default function TopQueriesCard({
  data,
}: {
  data: DashboardTopQuery[];
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <TrendingUp size={12} />
          </span>
          Top searches
        </div>
        <Link href="/admin/analytics" className="card-action">
          All queries →
        </Link>
      </div>
      <div className="query-list">
        {data.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-4)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            No searches recorded yet.
          </p>
        )}
        {data.map((q, i) => (
          <Link
            key={i}
            href={`/?q=${encodeURIComponent(q.q)}`}
            className="query-row"
          >
            <span className="rank">{String(i + 1).padStart(2, "0")}</span>
            <span className="q">{q.q}</span>
            <span className={`trend ${q.trend < 0 ? "down" : ""}`}>
              {q.trend > 0 ? "↑" : q.trend < 0 ? "↓" : ""}
              {Math.abs(q.trend)}%
            </span>
            <span className="count">{q.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
