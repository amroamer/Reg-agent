"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import FileDropZone from "@/components/documents/FileDropZone";
import StepWizard from "@/components/documents/StepWizard";
import MetadataForm, {
  type MetadataFormData,
} from "@/components/documents/MetadataForm";
import IngestionProgress from "@/components/documents/IngestionProgress";
import { useDocumentSSE } from "@/hooks/useDocumentSSE";
import api from "@/lib/api";
import type { FileValidationResponse, SourceAuthority } from "@/lib/types";

const STEPS = [
  { key: "select", label: "Select File" },
  { key: "metadata", label: "Review Metadata" },
  { key: "process", label: "Processing" },
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

export default function UploadWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<FileValidationResponse | null>(
    null,
  );
  const [validating, setValidating] = useState(false);
  const [form, setForm] = useState<MetadataFormData>(DEFAULT_FORM);
  const [uploading, setUploading] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ingestState = useDocumentSSE(step === 2 ? docId : null);

  // ── Step 1: file selection + validation ──

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

      // Pre-fill metadata from auto-detected values
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
        issues: ["Could not validate file — server may be unavailable"],
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

  // ── Step 2 → 3: upload & process ──

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
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
        setUploadError(
          ax.response?.data?.detail || "Upload failed. Check backend status.",
        );
      } else {
        setUploadError("Upload failed. Check network connectivity.");
      }
    } finally {
      setUploading(false);
    }
  };

  // ── Reset for another upload ──

  const handleRestart = () => {
    setStep(0);
    setFile(null);
    setValidation(null);
    setDocId(null);
    setUploadError(null);
    setForm(DEFAULT_FORM);
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h1>

      <StepWizard steps={STEPS} current={step} />

      {/* ═══════ Step 1 ═══════ */}
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
                    <h3 className="font-semibold text-gray-900">File is valid</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Size</p>
                      <p className="font-medium">
                        {validation.file_size_mb.toFixed(2)} MB
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pages</p>
                      <p className="font-medium">
                        {validation.page_count ?? "?"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <p className="font-medium">
                        {validation.is_scanned ? "Scanned (OCR)" : "Text-based"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Language</p>
                      <p className="font-medium capitalize">
                        {validation.detected_language ?? "?"}
                      </p>
                    </div>
                  </div>

                  {validation.duplicate.found && (
                    <div className="mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-yellow-800">
                        <strong>Duplicate detected:</strong> This file was
                        already uploaded as &quot;{validation.duplicate.existing_title}&quot;.
                        Uploading again will be rejected.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <h3 className="font-semibold text-red-700">Validation failed</h3>
                  </div>
                  <ul className="text-sm text-red-700 list-disc ps-5">
                    {validation.issues.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep(1)}
              disabled={
                !file || !validation?.valid || validation.duplicate.found || validating
              }
              className="px-5 py-2 bg-kpmg-blue text-white rounded-lg font-medium hover:bg-kpmg-blue-dark disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Step 2 ═══════ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
            <FileText className="w-4 h-4" />
            <span>Review metadata auto-detected from the PDF. You can edit any field.</span>
          </div>

          <MetadataForm value={form} onChange={setForm} />

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <div className="font-medium mb-1">Upload failed</div>
              <div className="text-xs">{uploadError}</div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(0)}
              className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleUpload}
              disabled={!form.source || uploading}
              className="px-5 py-2 bg-kpmg-blue text-white rounded-lg font-medium hover:bg-kpmg-blue-dark disabled:opacity-40 flex items-center gap-2"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              Upload & Process →
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Step 3 ═══════ */}
      {step === 2 && docId && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-kpmg-blue" />
              <span className="font-medium">{form.title_en || file?.name}</span>
              {form.document_number && (
                <span className="text-gray-500 font-mono text-xs">
                  • {form.document_number}
                </span>
              )}
            </div>
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

          {(ingestState.status === "indexed" || ingestState.status === "failed") && (
            <div className="flex items-center justify-end gap-2">
              {ingestState.status === "failed" ? (
                <>
                  <button
                    onClick={handleRestart}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Upload Different File
                  </button>
                  <button
                    onClick={async () => {
                      await api.post(`/documents/${docId}/retry`);
                    }}
                    className="px-4 py-2 text-sm bg-kpmg-blue text-white rounded-lg hover:bg-kpmg-blue-dark"
                  >
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleRestart}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Upload Another
                  </button>
                  <button
                    onClick={() => router.push("/admin/library")}
                    className="px-4 py-2 text-sm text-kpmg-blue hover:bg-kpmg-blue/10 rounded-lg"
                  >
                    Go to Library
                  </button>
                  <button
                    onClick={() => router.push(`/admin/library/${docId}`)}
                    className="px-4 py-2 text-sm bg-kpmg-blue text-white rounded-lg hover:bg-kpmg-blue-dark"
                  >
                    View Document
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
