import clsx from "clsx";

const STYLES: Record<string, string> = {
  indexed: "bg-green-100 text-green-700 border-green-200",
  active: "bg-green-100 text-green-700 border-green-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  superseded: "bg-orange-100 text-orange-700 border-orange-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
};

const LABELS: Record<string, string> = {
  indexed: "Active",
  active: "Active",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
  superseded: "Superseded",
  draft: "Draft",
};

export default function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border",
        STYLES[s] || STYLES.draft,
      )}
    >
      {LABELS[s] || status}
    </span>
  );
}
