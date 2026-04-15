"use client";

import { useCallback, useRef, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useBatchSSE } from "@/hooks/useBatchSSE";
import SourceBadge from "@/components/search/SourceBadge";
import api from "@/lib/api";
import type { BatchDetail, BulkUploadResponse, QueueItem } from "@/lib/types";
import {
  CheckCircle,
  ChevronDown,
  Download,
  Files,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";

const STAGES = [
  "extraction",
  "parsing",
  "markdown",
  "chunking",
  "embedding",
  "enrichment",
] as const;

const STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  extraction: { en: "Extract", ar: "استخراج" },
  parsing: { en: "Parse", ar: "تحليل" },
  markdown: { en: "Markdown", ar: "تنسيق" },
  chunking: { en: "Chunk", ar: "تقسيم" },
  embedding: { en: "Embed", ar: "تضمين" },
  enrichment: { en: "Enrich", ar: "إثراء" },
};

// ── Stage Progress Bar Component ──────────────────────

function StageBar({ item, lang }: { item: QueueItem; lang: "en" | "ar" }) {
  const progress = item.stage_progress || {};
  const currentStage = item.current_stage;

  return (
    <div className="flex gap-1 mt-2">
      {STAGES.map((stage) => {
        const info = progress[stage];
        const isComplete = info?.status === "completed";
        const isActive = stage === currentStage;
        const isPending = !info || info.status === "pending";

        return (
          <div key={stage} className="flex-1">
            <div
              className={`h-2 rounded-full transition-all ${
                isComplete
                  ? "bg-green-500"
                  : isActive
                    ? "bg-kpmg-blue animate-pulse"
                    : "bg-gray-200"
              }`}
            />
            <p className="text-[10px] text-gray-400 mt-0.5 text-center truncate">
              {STAGE_LABELS[stage]?.[lang] || stage}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Queue Item Row ────────────────────────────────────

function QueueItemRow({ item, lang }: { item: QueueItem; lang: "en" | "ar" }) {
  const [expanded, setExpanded] = useState(item.status === "failed");

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className="w-6 text-center">
          {item.status === "completed" && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          {item.status === "processing" && (
            <Loader2 className="w-5 h-5 text-kpmg-blue animate-spin" />
          )}
          {item.status === "failed" && (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          {item.status === "pending" && (
            <span className="text-xs text-gray-400">{item.position}</span>
          )}
        </div>

        {/* Filename */}
        <span className="text-sm font-medium text-gray-800 flex-1 truncate">
          {item.filename || `Document ${item.position}`}
        </span>

        {/* Source */}
        {item.source && <SourceBadge source={item.source} language={lang} />}

        {/* Status text */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            item.status === "completed"
              ? "bg-green-100 text-green-700"
              : item.status === "processing"
                ? "bg-blue-100 text-blue-700"
                : item.status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-500"
          }`}
        >
          {item.status === "processing" && item.current_stage
            ? item.current_stage
            : item.status}
        </span>

        {/* Expand */}
        {(item.status === "processing" || item.status === "failed") && (
          <button onClick={() => setExpanded(!expanded)}>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2">
          {item.status === "processing" && <StageBar item={item} lang={lang} />}
          {item.status === "failed" && item.error_message && (
            <p className="text-xs text-red-600 bg-red-50 rounded p-2 mt-1">
              {item.error_message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────

export default function BulkUploadPage() {
  const { language, t } = useLanguage();
  const lang = language as "en" | "ar";

  // Phase state
  const [phase, setPhase] = useState<"upload" | "progress">("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [defaultSource, setDefaultSource] = useState("SAMA");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // SSE connection for progress tracking
  const { batch, setBatch, isConnected } = useBatchSSE(batchId);

  // ── File handling ──

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf"),
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selected = Array.from(e.target.files).filter((f) =>
          f.name.toLowerCase().endsWith(".pdf"),
        );
        setFiles((prev) => [...prev, ...selected]);
      }
    },
    [],
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Upload ──

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (csvFile) formData.append("metadata_file", csvFile);
    formData.append("default_source", defaultSource);
    if (batchName) formData.append("batch_name", batchName);

    try {
      const { data } = await api.post<BulkUploadResponse>(
        "/documents/bulk-upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setUploadResult(data);
      setBatchId(data.batch_id);
      setPhase("progress");

      // Initialize batch state for SSE
      setBatch({
        id: data.batch_id,
        name: data.batch_name,
        status: "processing",
        total_documents: data.total_documents,
        completed_documents: 0,
        failed_documents: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        queue_items: data.documents.map((d) => ({
          id: d.document_id,
          document_id: d.document_id,
          filename: d.filename,
          source: d.source,
          position: d.queue_position,
          status: "pending" as const,
          current_stage: null,
          stage_progress: {},
          error_message: null,
          started_at: null,
          completed_at: null,
        })),
      });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail || "Upload failed"
          : "Upload failed";
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  // ── Retry ──

  const handleRetry = async () => {
    if (!batchId) return;
    await api.post(`/batches/${batchId}/retry-failed`);
  };

  // ── CSV template download ──

  const downloadTemplate = () => {
    const csv =
      "filename,source,document_number,title_ar,title_en,issue_date,effective_date,source_url\nexample.pdf,SAMA,SAMA-XXX-2024-01,العنوان بالعربي,English Title,2024-01-15,2024-04-01,https://sama.gov.sa/...";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reginspector-metadata-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render: Upload Phase ──

  if (phase === "upload") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {lang === "ar" ? "رفع مجمّع" : "Bulk Upload"}
        </h1>

        <div className="max-w-3xl space-y-6">
          {/* Batch name + source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {lang === "ar" ? "اسم الدفعة" : "Batch Name"} (optional)
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g., SAMA 2024 Q3 circulars"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {lang === "ar" ? "المصدر الافتراضي" : "Default Source"}
              </label>
              <select
                value={defaultSource}
                onChange={(e) => setDefaultSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="SAMA">SAMA</option>
                <option value="CMA">CMA</option>
                <option value="BANK_POLICY">Bank Policy</option>
              </select>
            </div>
          </div>

          {/* Drop zone */}
          <label
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-kpmg-blue hover:bg-kpmg-blue/5 transition"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              {lang === "ar"
                ? "اسحب وأفلت ملفات PDF هنا"
                : "Drag & drop multiple PDF files here"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              1-50 files, max 50MB each
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
            />
          </label>

          {/* CSV upload + template download */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Files className="w-4 h-4" />
              {csvFile ? csvFile.name : lang === "ar" ? "رفع ملف CSV للبيانات" : "Upload metadata CSV"}
            </button>
            <input
              ref={csvInputRef}
              type="file"
              className="hidden"
              accept=".csv,.json"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1 text-xs text-kpmg-blue hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              {lang === "ar" ? "تنزيل نموذج CSV" : "Download CSV template"}
            </button>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {files.length} {lang === "ar" ? "ملفات محددة" : "files selected"}
                </h3>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-red-500 hover:underline"
                >
                  {lang === "ar" ? "مسح الكل" : "Clear all"}
                </button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 px-2 text-sm hover:bg-gray-50 rounded"
                  >
                    <span className="text-gray-700 truncate">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {(f.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="w-full py-3 bg-kpmg-blue text-white rounded-lg font-medium hover:bg-kpmg-blue-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {lang === "ar"
              ? `رفع ومعالجة (${files.length} ملفات)`
              : `Upload & Process (${files.length} files)`}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Progress Phase ──

  const items = batch?.queue_items || [];
  const completed = batch?.completed_documents || 0;
  const failed = batch?.failed_documents || 0;
  const total = batch?.total_documents || 0;
  const progressPct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  const hasFailed = failed > 0;
  const isDone = batch?.status === "completed" || batch?.status === "failed";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {batch?.name || (lang === "ar" ? "رفع مجمّع" : "Bulk Upload")}
      </h1>

      {/* Overall progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600">
            {completed} / {total} {lang === "ar" ? "مكتمل" : "completed"}
            {failed > 0 && (
              <span className="text-red-500 ms-2">
                ({failed} {lang === "ar" ? "فشل" : "failed"})
              </span>
            )}
          </span>
          <span className="text-sm font-medium text-kpmg-blue">
            {progressPct}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: hasFailed
                ? "linear-gradient(90deg, #009A44 0%, #D0021B 100%)"
                : "#00338D",
            }}
          />
        </div>
        {isDone && (
          <p className="text-xs text-gray-500 mt-2">
            {lang === "ar" ? "اكتملت المعالجة" : "Processing complete"}
          </p>
        )}
      </div>

      {/* Warnings from upload */}
      {uploadResult && (uploadResult.duplicates.length > 0 || uploadResult.errors.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
          {uploadResult.duplicates.map((d, i) => (
            <p key={`d-${i}`}>Duplicate skipped: {d}</p>
          ))}
          {uploadResult.errors.map((e, i) => (
            <p key={`e-${i}`}>Error: {e}</p>
          ))}
        </div>
      )}

      {/* Queue items */}
      <div className="space-y-2">
        {items.map((item) => (
          <QueueItemRow key={item.id} item={item} lang={lang} />
        ))}
      </div>

      {/* Actions */}
      {isDone && hasFailed && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-kpmg-blue text-white rounded-lg text-sm hover:bg-kpmg-blue-dark"
          >
            <RefreshCw className="w-4 h-4" />
            {lang === "ar" ? "إعادة المحاولة للفاشلة" : "Retry Failed"}
          </button>
        </div>
      )}
    </div>
  );
}
