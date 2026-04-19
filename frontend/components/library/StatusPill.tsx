"use client";

import type { DocumentStatus } from "@/lib/types";

interface StatusPillProps {
  status: DocumentStatus | string;
  progress?: number | null;
}

const LABELS: Record<string, string> = {
  indexed: "Indexed",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
  superseded: "Superseded",
};

// Map DB status → design class. Anything unrecognised falls through to pending.
function cls(status: string): string {
  const s = status?.toLowerCase?.() ?? "";
  if (s === "indexed") return "indexed";
  if (s === "processing") return "processing";
  if (s === "failed") return "failed";
  return "pending";
}

export default function StatusPill({ status, progress }: StatusPillProps) {
  const label = LABELS[status?.toLowerCase?.() ?? ""] ?? status;
  return (
    <span className={`status-pill ${cls(status)}`}>
      {label}
      {status === "processing" && progress != null && (
        <span style={{ opacity: 0.7 }}>· {progress}%</span>
      )}
    </span>
  );
}
