"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import FileDropZone from "@/components/documents/FileDropZone";
import IngestionProgress from "@/components/documents/IngestionProgress";
import MetadataForm, {
  type MetadataFormData,
} from "@/components/documents/MetadataForm";
import StepWizard from "@/components/documents/StepWizard";
import { useDocumentSSE } from "@/hooks/useDocumentSSE";
import { useToast } from "@/hooks/useToast";
import api from "@/lib/api";
import type { FileValidationResponse, SourceAuthority } from "@/lib/types";

const STEPS = [
  { key: "select", label: "Select" },
  { key: "metadata", label: "Metadata" },
  { key: "process", label: "Process" },
];

const DEFAULT_FORM: MetadataFormData = {
  source: "SAMA",
  document_number: "",
  title_en: "",
  title_ar: "",
  issue_date: "",
  effective_date: "",
  source_url: "",
};

interface UploadSlideOverProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export default function UploadSlideOver({
  open,
  onClose,
  onCompleted,
}: UploadSlideOverProps) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<FileValidationResponse | null>(
    null,
  );
  const [validating, setValidating] = useState(false);
  const [form, setForm] = useState<MetadataFormData>(DEFAULT_FORM);
  const [uploading, setUploading] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ingestState = useDocumentSSE(step === 2 ? docId : null);

  const handleFileSelected = async (f: File) => {
    setFile(f);
    setValidation(null);
    setValidating(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post<FileValidationResponse>(
        "/documents/validate",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setValidation(data);
      const m = data.auto_detected_metadata;
      setForm({
        source: (m.source as SourceAuthority) || "SAMA",
        document_number: m.document_number || "",
        title_en: m.title_en || f.name.replace(/\.pdf$/i, ""),
        title_ar: m.title_ar || "",
        issue_date: "",
        effective_date: "",
        source_url: "",
      });
    } catch {
      setValidation({
        valid: false,
        issues: ["Could not validate file — backend unavailable"],
        file_size_mb: 0,
        page_count: null,
        is_scanned: false,
        detected_language: null,
        file_hash: null,
        duplicate: { found: false },
        auto_detected_metadata: {},
      });
    } finally {
      setValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", form.source);
      if (form.title_en) fd.append("title_en", form.title_en);
      if (form.title_ar) fd.append("title_ar", form.title_ar);
      if (form.document_number) fd.append("document_number", form.document_number);
      const { data } = await api.post("/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocId(data.id);
      setStep(2);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const ax = err as { response?: { data?: { detail?: string } } };
        setError(ax.response?.data?.detail || "Upload failed");
      } else {
        setError("Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    // Notify parent so it refreshes library
    if (docId) onCompleted?.();
    // Reset
    setStep(0);
    setFile(null);
    setValidation(null);
    setDocId(null);
    setError(null);
    setForm(DEFAULT_FORM);
    onClose();
  };

  const handleUploadMore = () => {
    // Notify parent of completion but keep panel open, reset state
    onCompleted?.();
    setStep(0);
    setFile(null);
    setValidation(null);
    setDocId(null);
    setError(null);
    setForm(DEFAULT_FORM);
    toast.notify("success", "Document uploaded", "Ready for next upload");
  };

  const goToDoc = () => {
    const id = docId;
    handleClose();
    if (id) router.push(`/admin/library/${id}`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={handleClose}
    >
      <div
        className="absolute top-0 end-0 h-full w-full max-w-lg bg-white shadow-2xl overflow-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between z-10">
          <h2 className="font-semibold text-gray-900">Upload Document</h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1">
          <StepWizard steps={STEPS} current={step} />

          {/* ═══════ Step 1: Select ═══════ */}
          {step === 0 && (
            <div className="space-y-4">
              <FileDropZone
                onFileSelected={handleFileSelected}
                currentFile={file}
                onRemove={() => {
                  setFile(null);
                  setValidation(null);
                }}
              />

              {validating && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating file...
                </div>
              )}

              {validation && (
                <div
                  className={`rounded-xl border p-4 ${
                    validation.valid
                      ? "bg-white border-gray-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  {validation.valid ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <h3 className="font-semibold text-gray-900 text-sm">
                          File is valid
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">Size</p>
                          <p className="font-medium text-gray-900">
                            {validation.file_size_mb.toFixed(2)} MB
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Pages</p>
                          <p className="font-medium text-gray-900">
                            {validation.page_count ?? "?"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Type</p>
                          <p className="font-medium text-gray-900">
                            {validation.is_scanned
                              ? "Scanned (OCR)"
                              : "Text-based"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Language</p>
                          <p className="font-medium text-gray-900 capitalize">
                            {validation.detected_language ?? "?"}
                          </p>
                        </div>
                      </div>
                      {validation.duplicate.found && (
                        <div className="mt-3 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-yellow-800">
                            <strong>Duplicate:</strong> This file was already
                            uploaded as &quot;{validation.duplicate.existing_title}
                            &quot;.
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-500" />
                        <h3 className="font-semibold text-red-700 text-sm">
                          Validation failed
                        </h3>
                      </div>
                      <ul className="text-xs text-red-700 list-disc ps-5">
                        {validation.issues.map((i, idx) => (
                          <li key={idx}>{i}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════ Step 2: Metadata ═══════ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-xs text-blue-800">
                <FileText className="w-4 h-4" />
                <span>Metadata auto-detected. Edit any field.</span>
              </div>
              <MetadataForm value={form} onChange={setForm} />
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <div className="font-medium mb-1">Upload failed</div>
                  <div>{error}</div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ Step 3: Process ═══════ */}
          {step === 2 && docId && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-kpmg-blue" />
                  <span className="font-medium">{form.title_en || file?.name}</span>
                </div>
                {form.document_number && (
                  <p className="text-gray-500 font-mono mt-1">
                    {form.document_number}
                  </p>
                )}
              </div>

              <IngestionProgress
                stages={ingestState.stages}
                currentStage={ingestState.currentStage}
                documentStatus={ingestState.status}
                errorMessage={ingestState.errorMessage}
                startedAt={ingestState.startedAt}
                summary={{
                  page_count: ingestState.pageCount ?? undefined,
                  total_articles: ingestState.totalArticles,
                  total_chunks: ingestState.totalChunks,
                }}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between gap-2">
          {step === 0 && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(1)}
                disabled={
                  !file ||
                  !validation?.valid ||
                  validation.duplicate.found ||
                  validating
                }
                className="px-5 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleUpload}
                disabled={!form.source || uploading}
                className="px-5 py-2 bg-kpmg-blue text-white rounded-lg text-sm font-medium hover:bg-kpmg-blue-dark disabled:opacity-40 flex items-center gap-1"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload & Process →
              </button>
            </>
          )}

          {step === 2 && (ingestState.status === "indexed" || ingestState.status === "failed") && (
            <>
              {ingestState.status === "failed" ? (
                <>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Close
                  </button>
                  <button
                    onClick={async () => {
                      if (docId) await api.post(`/documents/${docId}/retry`);
                    }}
                    className="px-4 py-2 text-sm bg-kpmg-blue text-white rounded-lg hover:bg-kpmg-blue-dark"
                  >
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleUploadMore}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Upload More
                  </button>
                  <button
                    onClick={goToDoc}
                    className="px-4 py-2 text-sm bg-kpmg-blue text-white rounded-lg hover:bg-kpmg-blue-dark"
                  >
                    View Document
                  </button>
                </>
              )}
            </>
          )}

          {step === 2 && ingestState.status !== "indexed" && ingestState.status !== "failed" && (
            <div className="text-xs text-gray-500 w-full text-center">
              Ingesting... you can close this panel and check back later.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
