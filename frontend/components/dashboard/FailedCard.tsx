"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import Link from "next/link";
import type { DashboardFailed } from "@/lib/types";

interface FailedCardProps {
  data: DashboardFailed[];
  onRetry?: (documentId: string) => void;
  onRetryAll?: () => void;
}

export default function FailedCard({
  data,
  onRetry,
  onRetryAll,
}: FailedCardProps) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">
            <span
              className="card-ico"
              style={{ background: "#fdeae6", color: "#b42818" }}
            >
              <AlertTriangle size={12} />
            </span>
            Needs attention
          </div>
          <div className="card-sub">
            {data.length === 0
              ? "Nothing failing — all documents processed cleanly"
              : `${data.length} document${data.length !== 1 ? "s" : ""} failed processing`}
          </div>
        </div>
        {data.length > 0 && onRetryAll && (
          <button
            className="card-action"
            style={{ color: "var(--primary)", fontWeight: 600 }}
            onClick={onRetryAll}
          >
            Retry all
          </button>
        )}
      </div>
      {data.length > 0 && (
        <div>
          {data.map((f) => (
            <div className="fail-row" key={f.document_id}>
              <div>
                <Link
                  href={`/admin/library/${f.document_id}`}
                  className="fail-title"
                  style={{ textDecoration: "none" }}
                >
                  {f.title}
                </Link>
                <div className="fail-sub">
                  {f.code && <span className="fail-code">{f.code}</span>}
                  {f.error && <span>{f.error}</span>}
                </div>
              </div>
              {onRetry && (
                <button
                  className="pa-btn primary"
                  onClick={() => onRetry(f.document_id)}
                >
                  <RotateCw size={11} /> Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
