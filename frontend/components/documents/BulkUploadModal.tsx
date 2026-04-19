"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  Download,
  Edit,
  Files,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import FileDropZone from "@/components/documents/FileDropZone";
import MetadataForm, {
  type MetadataFormData,
} from "@/components/documents/MetadataForm";
import { useBatchSSE } from "@/hooks/useBatchSSE";
import { useToast } from "@/hooks/useToast";
import api from "@/lib/api";
import type { BulkUploadResponse, SourceAuthority } from "@/lib/types";

interface FileRow {
  id: string; // client-side id
  file: File;
  metadata: MetadataFormData;
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

const BLANK_METADATA: MetadataFormData = {
  source: "SAMA",
  document_number: "",
  title_en: "",
  title_ar: "",
  issue_date: "",
  effective_date: "",
  source_url: "",
};

// Try to detect source from filename: SAMA*.pdf, CMA*.pdf, bp-*.pdf, etc.
function detectSource(name: string): SourceAuthority {
  const n = name.toLowerCase();
  if (n.includes("sama")) return "SAMA";
  if (n.includes("cma")) return "CMA";
  if (n.startsWith("bp-") || n.includes("policy") || n.includes("bank")) return "BANK_POLICY";
  return "SAMA";
}

function detectDocNumber(name: string): string {
  const stem = name.replace(/\.pdf$/i, "");
  const m = stem.match(/(SAMA|CMA|BP)[\-_][\w\-]+/i);
  return m ? m[0].toUpperCase() : "";
}

export default function BulkUploadModal({
  open,
  onClose,
  onCompleted,
}: BulkUploadModalProps) {
  const toast = useToast();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"select" | "progress" | "complete">("select");
  const [rows, setRows] = useState<FileRow[]>([]);
  const [batchName, setBatchName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null);

  const { batch } = useBatchSSE(phase === "progress" ? batchId : null);

  // Auto-transition to complete when batch finishes
  useEffect(() => {
    if (!batch) return;
    if (batch.status === "completed" || batch.status === "failed") {
      setPhase("complete");
    }
  }, [batch]);

  // ─── File handlers ───

  const addFiles = useCallback((files: File[]) => {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const newRows: FileRow[] = pdfs.map((f) => ({
      id: `${Date.now()}-${f.name}-${Math.random()}`,
      file: f,
      metadata: {
        ...BLANK_METADATA,
        source: detectSource(f.name),
        document_number: detectDocNumber(f.name),
        title_en: f.name.replace(/\.pdf$/i, ""),
      },
    }));
    setRows((prev) => [...prev, ...newRows]);
  }, []);

  const handleFileSelected = (f: File) => {
    addFiles([f]);
  };

  const handleMultiDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = Array.from(e.dataTransfer.files);
      addFiles(dropped);
    },
    [addFiles],
  );

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateRow = (i: number, patch: Partial<MetadataFormData>) => {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i ? { ...r, metadata: { ...r.metadata, ...patch } } : r,
      ),
    );
  };

  const downloadTemplate = () => {
    const csv =
      "filename,source,document_number,title_ar,title_en,issue_date,effective_date,source_url\nexample.pdf,SAMA,SAMA-XXX-2024-01,العنوان,English Title,2024-01-15,2024-04-01,https://...";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reginspector-metadata-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Submit ───

  const handleSubmit = async () => {
    if (rows.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    for (const row of rows) {
      fd.append("files", row.file);
    }
    if (csvFile) fd.append("metadata_file", csvFile);

    // Build JSON metadata array (one entry per file) as metadata_file with type application/json
    const metadataList = rows.map((r) => ({
      filename: r.file.name,
      source: r.metadata.source,
      document_number: r.metadata.document_number || null,
      title_en: r.metadata.title_en || null,
      title_ar: r.metadata.title_ar || null,
      issue_date: r.metadata.issue_date || null,
      effective_date: r.metadata.effective_date || null,
      source_url: r.metadata.source_url || null,
    }));

    // Build a JSON file to send as metadata_file
    if (!csvFile && metadataList.length > 0) {
      const jsonBlob = new Blob([JSON.stringify(metadataList)], {
        type: "application/json",
      });
      fd.append("metadata_file", jsonBlob, "metadata.json");
    }

    // Default source = most common source in rows
    const firstSource = rows[0]?.metadata.source || "SAMA";
    fd.append("default_source", firstSource);
    if (batchName) fd.append("batch_name", batchName);

    try {
      const { data } = await api.post<BulkUploadResponse>(
        "/documents/bulk-upload",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setUploadResult(data);
      setBatchId(data.batch_id);
      setPhase("progress");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail || "Bulk upload failed"
          : "Bulk upload failed";
      toast.notify("error", "Upload failed", msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    onCompleted?.();
    // Reset
    setPhase("select");
    setRows([]);
    setBatchName("");
    setCsvFile(null);
    setBatchId(null);
    setUploadResult(null);
    onClose();
  };

  if (!open) return null;

  const editingRow = editIdx !== null ? rows[editIdx] : null;

  const rowMissingRequired = (r: FileRow) => !r.metadata.source;
  const rowMissingRecommended = (r: FileRow) =>
    !r.metadata.document_number || !r.metadata.title_en;

  const anyMissingRequired = rows.some(rowMissingRequired);
  const missingRecommendedCount = rows.filter(rowMissingRecommended).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-lg">
            {phase === "select" && "Bulk Upload"}
            {phase === "progress" && "Bulk Upload — Processing"}
            {phase === "complete" && "Bulk Upload — Complete"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {phase === "select" && (
            <div className="space-y-5">
              {/* File drop zone */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleMultiDrop}
                className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-kpmg-blue hover:bg-kpmg-blue/5 transition"
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop PDF files here, or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  1-50 files • Max 50MB each
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                  }}
                />
              </label>

              {/* CSV + batch name */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => csvInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Files className="w-4 h-4" />
                  {csvFile ? csvFile.name : "Upload metadata CSV"}
                </button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1 text-xs text-kpmg-blue hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV template
                </button>
                <div className="flex-1" />
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Batch name (optional)"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none min-w-60"
                />
              </div>

              {/* File table */}
              {rows.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      {rows.length} file{rows.length !== 1 ? "s" : ""} selected
                    </p>
                    <button
                      onClick={() => setRows([])}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <th className="px-3 py-2 text-start w-10">#</th>
                          <th className="px-3 py-2 text-start">File</th>
                          <th className="px-3 py-2 text-start w-32">Source</th>
                          <th className="px-3 py-2 text-start">Doc Number</th>
                          <th className="px-3 py-2 text-start">Title (EN)</th>
                          <th className="px-3 py-2 text-end w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r, i) => {
                          const hasReq = !rowMissingRequired(r);
                          const hasRec = !rowMissingRecommended(r);
                          const border = !hasReq
                            ? "border-s-4 border-red-500"
                            : !hasRec
                              ? "border-s-4 border-yellow-500"
                              : "border-s-4 border-green-500";
                          return (
                            <tr key={r.id} className={`hover:bg-gray-50 ${border}`}>
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2">
                                <p className="text-sm font-medium text-gray-800 truncate max-w-60">
                                  {r.file.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {(r.file.size / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={r.metadata.source}
                                  onChange={(e) =>
                                    updateRow(i, {
                                      source: e.target.value as SourceAuthority,
                                    })
                                  }
                                  className="text-xs border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="SAMA">SAMA</option>
                                  <option value="CMA">CMA</option>
                                  <option value="BANK_POLICY">Bank Policy</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={r.metadata.document_number}
                                  onChange={(e) =>
                                    updateRow(i, {
                                      document_number: e.target.value,
                                    })
                                  }
                                  placeholder="⚠ Not set"
                                  className="text-xs border border-gray-200 rounded px-2 py-1 w-40 focus:border-kpmg-blue focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={r.metadata.title_en}
                                  onChange={(e) =>
                                    updateRow(i, { title_en: e.target.value })
                                  }
                                  placeholder="⚠ Not set"
                                  className="text-xs border border-gray-200 rounded px-2 py-1 w-48 focus:border-kpmg-blue focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-end">
                                <button
                                  onClick={() => setEditIdx(i)}
                                  className="p-1 text-gray-500 hover:text-kpmg-blue"
                                  title="Edit full metadata"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeRow(i)}
                                  className="p-1 text-gray-500 hover:text-red-500 ms-1"
                                  title="Remove"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Warnings */}
                  {(anyMissingRequired || missingRecommendedCount > 0) && (
                    <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      {anyMissingRequired && (
                        <p>⚠ Some files are missing the required Source field</p>
                      )}
                      {missingRecommendedCount > 0 && (
                        <p>
                          ⚠ {missingRecommendedCount} file
                          {missingRecommendedCount !== 1 ? "s are" : " is"} missing
                          document number or title. Click ✏ to fill details.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════ Progress phase ═══════ */}
          {phase === "progress" && batch && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  {batch.completed_documents} of {batch.total_documents} completed
                  {batch.failed_documents > 0 && (
                    <span className="text-red-600 ms-2">
                      • {batch.failed_documents} failed
                    </span>
                  )}
                </p>
                <p className="text-sm font-medium text-kpmg-blue">
                  {Math.round(
                    ((batch.completed_documents + batch.failed_documents) /
                      Math.max(batch.total_documents, 1)) *
                      100,
                  )}
                  %
                </p>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-kpmg-blue transition-all"
                  style={{
                    width: `${Math.round(
                      ((batch.completed_documents + batch.failed_documents) /
                        Math.max(batch.total_documents, 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-auto">
                {batch.queue_items.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg"
                  >
                    {q.status === "completed" && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {q.status === "processing" && (
                      <Loader2 className="w-4 h-4 text-kpmg-blue animate-spin flex-shrink-0" />
                    )}
                    {q.status === "failed" && (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    {q.status === "pending" && (
                      <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium text-gray-800 flex-1 truncate">
                      {q.filename || `Document ${q.position}`}
                    </p>
                    {q.current_stage && q.status === "processing" && (
                      <span className="text-xs text-blue-700 px-2 py-0.5 bg-blue-50 rounded">
                        {q.current_stage}
                      </span>
                    )}
                    {q.status === "failed" && q.error_message && (
                      <span className="text-xs text-red-600 truncate max-w-60">
                        {q.error_message.slice(0, 80)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ Complete phase ═══════ */}
          {phase === "complete" && batch && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">
                    Bulk upload complete
                  </p>
                  <p className="text-sm text-green-700 mt-0.5">
                    {batch.completed_documents} of {batch.total_documents} documents
                    processed successfully
                    {batch.failed_documents > 0 &&
                      ` (${batch.failed_documents} failed)`}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {batch.queue_items.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg"
                  >
                    {q.status === "completed" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                      {q.filename || `Document ${q.position}`}
                    </span>
                    <a
                      href={`/admin/library/${q.document_id}`}
                      className="text-xs text-kpmg-blue hover:underline"
                    >
                      View →
                    </a>
                  </div>
                ))}
              </div>

              {uploadResult && (uploadResult.duplicates.length > 0 || uploadResult.errors.length > 0) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
                  {uploadResult.duplicates.map((d, i) => (
                    <p key={`d-${i}`}>⚠ Duplicate skipped: {d}</p>
                  ))}
                  {uploadResult.errors.map((e, i) => (
                    <p key={`e-${i}`}>⚠ {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex items-center justify-between flex-shrink-0">
          {phase === "select" && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={rows.length === 0 || anyMissingRequired || uploading}
                className="px-5 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark disabled:opacity-40 flex items-center gap-1"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload & Process ({rows.length} {rows.length === 1 ? "file" : "files"})
              </button>
            </>
          )}
          {phase === "progress" && (
            <div className="text-xs text-gray-500 w-full text-center">
              Processing... you can close this modal and check back in the library.
            </div>
          )}
          {phase === "complete" && (
            <button
              onClick={handleClose}
              className="ms-auto px-5 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Per-row edit slide-over */}
      {editingRow !== null && editIdx !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setEditIdx(null)}
        >
          <div
            className="absolute top-0 end-0 h-full w-full max-w-lg bg-white shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Edit Metadata</h2>
                <p className="text-xs text-gray-500 truncate max-w-96 mt-1">
                  {editingRow.file.name}
                </p>
              </div>
              <button
                onClick={() => setEditIdx(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <MetadataForm
                value={editingRow.metadata}
                onChange={(m) => updateRow(editIdx, m)}
              />
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => setEditIdx(null)}
                className="px-5 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark"
              >
                Save & Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
