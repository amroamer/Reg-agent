"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import type { Document } from "@/lib/types";

interface FailedBannerProps {
  failedDocs: Document[];
  onRetryAll?: () => void;
  onViewFailed?: () => void;
}

export default function FailedBanner({
  failedDocs,
  onRetryAll,
  onViewFailed,
}: FailedBannerProps) {
  if (failedDocs.length === 0) return null;
  const preview = failedDocs
    .slice(0, 2)
    .map((d) => d.title_en || d.title_ar || "Untitled")
    .join(", ");
  const more = failedDocs.length > 2 ? ` +${failedDocs.length - 2} more` : "";

  return (
    <div className="dl-banner">
      <div className="dl-banner-icon">
        <AlertTriangle size={14} />
      </div>
      <div className="dl-banner-body">
        <b>
          {failedDocs.length} document
          {failedDocs.length !== 1 ? "s" : ""} failed to process.
        </b>{" "}
        <span className="dim">
          {preview}
          {more}
        </span>
      </div>
      {onRetryAll && (
        <button className="btn sm" onClick={onRetryAll}>
          <RotateCw size={11} />
          Retry all
        </button>
      )}
      {onViewFailed && (
        <button className="btn sm" onClick={onViewFailed}>
          View failed
        </button>
      )}
    </div>
  );
}
