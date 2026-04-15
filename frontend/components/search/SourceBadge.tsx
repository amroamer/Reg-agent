import clsx from "clsx";

const BADGE_STYLES = {
  SAMA: "bg-sama/10 text-sama border-sama/20",
  CMA: "bg-cma/10 text-cma border-cma/20",
  BANK_POLICY: "bg-bank/10 text-bank border-bank/20",
} as const;

const BADGE_LABELS = {
  SAMA: { en: "SAMA", ar: "ساما" },
  CMA: { en: "CMA", ar: "هيئة السوق" },
  BANK_POLICY: { en: "Bank Policy", ar: "سياسة البنك" },
} as const;

interface SourceBadgeProps {
  source: string;
  language?: "en" | "ar";
  size?: "sm" | "md";
}

export default function SourceBadge({
  source,
  language = "en",
  size = "sm",
}: SourceBadgeProps) {
  const key = source as keyof typeof BADGE_STYLES;
  const style = BADGE_STYLES[key] || "bg-gray-100 text-gray-600 border-gray-200";
  const label = BADGE_LABELS[key]?.[language] || source;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-medium",
        style,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      )}
    >
      {label}
    </span>
  );
}
