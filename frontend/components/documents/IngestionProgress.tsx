"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle, ChevronDown, Circle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const STAGES = [
  { key: "extraction", label: "PDF Extraction", desc: "Extracting text and tables from PDF" },
  { key: "parsing", label: "Structural Parsing", desc: "Detecting chapters, articles, sub-articles" },
  { key: "markdown", label: "Markdown Generation", desc: "Building bilingual readable output" },
  { key: "chunking", label: "Chunking", desc: "Splitting articles into searchable segments" },
  { key: "embedding", label: "Embedding", desc: "Generating vector embeddings" },
  { key: "enrichment", label: "Enrichment", desc: "Topics & cross-references" },
] as const;

const STAGE_ERROR_HELP: Record<string, string> = {
  extraction:
    "The PDF could not be read. It may be corrupted, password-protected, or an unsupported format.",
  parsing:
    "Could not detect article structure. The document may use a non-standard layout.",
  markdown: "Failed to generate readable format. The parsed structure may be incomplete.",
  chunking: "Failed to split articles into searchable segments.",
  embedding:
    "Failed to generate vector embeddings. The embedding model may be unavailable — check that Qdrant is running.",
  enrichment:
    "Failed to classify topics or suggest cross-references. The LLM service may be unavailable.",
};

export type StageStatus = "pending" | "processing" | "completed" | "failed";

export interface StageState {
  status: StageStatus;
  duration_s?: number;
}

interface IngestionProgressProps {
  stages: Record<string, StageState>;
  currentStage: string | null;
  documentStatus: string; // indexed | processing | pending | failed
  errorMessage?: string | null;
  summary?: {
    page_count?: number;
    total_articles?: number;
    total_chunks?: number;
  };
  startedAt?: Date | null;
}

export default function IngestionProgress({
  stages,
  currentStage,
  documentStatus,
  errorMessage,
  summary,
  startedAt,
}: IngestionProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const isDone = documentStatus === "indexed" || documentStatus === "failed";
  const isFailed = documentStatus === "failed";

  useEffect(() => {
    if (!startedAt || isDone) return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isDone]);

  const failedStage = isFailed ? currentStage || "unknown" : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Stages */}
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const info = stages[stage.key] || { status: "pending" };
          const isCurrent = currentStage === stage.key && !isDone;
          const isComplete = info.status === "completed";
          const isFailedStage = isFailed && failedStage === stage.key;

          return (
            <div
              key={stage.key}
              className={clsx(
                "flex items-start gap-3 p-3 rounded-lg transition",
                isComplete && "bg-green-50",
                isCurrent && "bg-blue-50",
                isFailedStage && "bg-red-50",
              )}
            >
              {/* Icon */}
              <div className="flex-shrink-0 pt-0.5">
                {isComplete ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : isFailedStage ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-kpmg-blue animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={clsx(
                      "font-medium text-sm",
                      isComplete && "text-gray-800",
                      isCurrent && "text-kpmg-blue",
                      isFailedStage && "text-red-600",
                      !isComplete && !isCurrent && !isFailedStage && "text-gray-400",
                    )}
                  >
                    Stage {i + 1}: {stage.label}
                  </p>
                  {info.duration_s != null && (
                    <span className="text-xs text-gray-500">{info.duration_s}s</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{stage.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timer + summary */}
      {!isDone && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
          ⏱ Elapsed: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </div>
      )}

      {/* Success card */}
      {documentStatus === "indexed" && summary && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-gray-900">Document processed successfully!</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
            <div>
              <p className="text-2xl font-bold text-kpmg-blue">{summary.page_count ?? 0}</p>
              <p className="text-xs text-gray-500">Pages</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-kpmg-blue">{summary.total_articles ?? 0}</p>
              <p className="text-xs text-gray-500">Articles</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-kpmg-blue">{summary.total_chunks ?? 0}</p>
              <p className="text-xs text-gray-500">Chunks</p>
            </div>
          </div>
        </div>
      )}

      {/* Failure card */}
      {isFailed && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-700">
                Processing failed at Stage {failedStage ? STAGES.findIndex((s) => s.key === failedStage) + 1 : "?"}:{" "}
                {failedStage ? STAGES.find((s) => s.key === failedStage)?.label : "Unknown"}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                {STAGE_ERROR_HELP[failedStage || ""] || "An unexpected error occurred."}
              </p>
            </div>
          </div>
          {errorMessage && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-kpmg-blue hover:underline mt-3"
            >
              <ChevronDown
                className={clsx("w-4 h-4 transition", showDetails && "rotate-180")}
              />
              Technical Details
            </button>
          )}
          {showDetails && errorMessage && (
            <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-auto max-h-48 whitespace-pre-wrap">
              {errorMessage}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
