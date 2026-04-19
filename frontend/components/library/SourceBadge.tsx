"use client";

const LABELS: Record<string, string> = {
  SAMA: "SAMA",
  CMA: "CMA",
  BANK_POLICY: "Bank Policy",
};

const CLASS_MAP: Record<string, string> = {
  SAMA: "sama",
  CMA: "cma",
  BANK_POLICY: "bank",
};

interface SourceBadgeProps {
  source: string;
}

/**
 * Source authority pill (SAMA blue / CMA green / Bank Policy orange).
 * Matches .src-badge in library.css.
 */
export default function LibrarySourceBadge({ source }: SourceBadgeProps) {
  const cls = CLASS_MAP[source] ?? "sama";
  const label = LABELS[source] ?? source;
  return <span className={`src-badge ${cls}`}>{label}</span>;
}
