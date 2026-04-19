"use client";

import clsx from "clsx";
import { CheckCircle, Circle, Clock, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Document } from "@/lib/types";

const STAGES = [
  "extraction",
  "parsing",
  "markdown",
  "chunking",
  "embedding",
  "enrichment",
] as const;

const STAGE_LABELS: Record<string, string> = {
  extraction: "PDF Extraction",
  parsing: "Parsing",
  markdown: "Markdown",
  chunking: "Chunking",
  embedding: "Embedding",
  enrichment: "Enrichment",
};

interface StatusCellProps {
  doc: Document;
  currentStage?: string | null;
  stageProgress?: Record<string, { status: string; duration_s?: number }>;
  onRetry?: () => void;
}

export default function StatusCell({
  doc,
  currentStage,
  stageProgress = {},
  onRetry,
}: StatusCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const status = doc.status;

  // ─── Indexed ───
  if (status === "indexed") {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="text-sm font-medium text-green-700">Indexed</span>
      </div>
    );
  }

  // ─── Pending ───
  if (status === "pending") {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-700">Pending</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Queued for processing</p>
      </div>
    );
  }

  // ─── Processing ───
  if (status === "processing") {
    const stageIndex = currentStage ? STAGES.indexOf(currentStage as (typeof STAGES)[number]) : 0;
    const stageNum = stageIndex >= 0 ? stageIndex + 1 : 1;
    const percent = Math.round((stageNum / STAGES.length) * 100);

    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="text-start"
        >
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-blue-700">
              Stage {stageNum} of 6
            </span>
          </div>
          <div className="mt-1 w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </button>

        {open && (
          <div className="absolute start-0 top-full mt-2 z-20 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Ingestion Progress
            </p>
            <div className="space-y-1.5">
              {STAGES.map((s, i) => {
                const info = stageProgress[s];
                const done = info?.status === "completed";
                const active = currentStage === s;
                return (
                  <div
                    key={s}
                    className="flex items-center gap-2 text-xs"
                  >
                    {done ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : active ? (
                      <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                    <span
                      className={clsx(
                        "flex-1",
                        done && "text-gray-700",
                        active && "text-blue-700 font-medium",
                        !done && !active && "text-gray-400",
                      )}
                    >
                      {i + 1}. {STAGE_LABELS[s]}
                    </span>
                    {info?.duration_s != null && (
                      <span className="text-gray-400">
                        {info.duration_s.toFixed(1)}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Failed ───
  if (status === "failed") {
    const errMsg = doc.error_message || "Unknown error";
    const brief = errMsg.length > 40 ? errMsg.slice(0, 40) + "..." : errMsg;

    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="text-start w-full"
        >
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">Failed</span>
          </div>
          <p className="text-xs text-red-600 mt-0.5 truncate max-w-[180px]">
            {brief}
          </p>
        </button>

        {open && (
          <div className="absolute start-0 top-full mt-2 z-20 w-80 bg-white rounded-lg shadow-lg border border-red-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-semibold text-red-700">
                Ingestion Failed
              </p>
            </div>
            <p className="text-xs text-gray-700 mb-3 whitespace-pre-wrap">{errMsg}</p>
            {onRetry && (
              <button
                onClick={() => {
                  onRetry();
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 bg-kpmg-blue text-white text-xs rounded-lg hover:bg-kpmg-blue-dark"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Superseded ───
  if (status === "superseded") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-[10px] text-orange-600">
          ↻
        </span>
        <span className="text-sm font-medium text-orange-700">Superseded</span>
      </div>
    );
  }

  return <span className="text-sm text-gray-500 capitalize">{status}</span>;
}
