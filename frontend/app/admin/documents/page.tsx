"use client";

import { useCallback, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import api from "@/lib/api";
import { Upload, FileText, Loader2, CheckCircle, XCircle } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function AdminDocumentsPage() {
  const { t } = useLanguage();
  const [source, setSource] = useState("SAMA");
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          setMessage("Only PDF files are allowed");
          setStatus("error");
          continue;
        }

        setStatus("uploading");
        setMessage(`Uploading ${file.name}...`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("source", source);
        if (titleEn) formData.append("title_en", titleEn);
        if (titleAr) formData.append("title_ar", titleAr);
        if (docNumber) formData.append("document_number", docNumber);

        try {
          await api.post("/documents/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setStatus("success");
          setMessage(`${file.name} uploaded successfully. Ingestion started.`);
          setTitleEn("");
          setTitleAr("");
          setDocNumber("");
        } catch (err: unknown) {
          setStatus("error");
          if (err && typeof err === "object" && "response" in err) {
            const axiosErr = err as {
              response?: { data?: { detail?: string } };
            };
            setMessage(
              axiosErr.response?.data?.detail || "Upload failed",
            );
          } else {
            setMessage("Upload failed");
          }
        }
      }
    },
    [source, titleEn, titleAr, docNumber],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t("uploadDocument")}
      </h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
        {/* Metadata Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source *
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="SAMA">SAMA</option>
              <option value="CMA">CMA</option>
              <option value="BANK_POLICY">Bank Policy</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Number
            </label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="e.g., SAMA/R-2024-103"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (English)
            </label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (Arabic)
            </label>
            <input
              type="text"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-arabic"
              dir="rtl"
            />
          </div>
        </div>

        {/* Drop Zone */}
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-kpmg-blue hover:bg-kpmg-blue/5 transition">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">{t("dragDropPdf")}</p>
          <p className="text-xs text-gray-400 mt-1">Max 50MB per file</p>
          <input
            type="file"
            className="hidden"
            accept=".pdf"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>

        {/* Status Message */}
        {status !== "idle" && (
          <div
            className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
              status === "uploading"
                ? "bg-blue-50 text-blue-700"
                : status === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {status === "uploading" && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {status === "success" && <CheckCircle className="w-4 h-4" />}
            {status === "error" && <XCircle className="w-4 h-4" />}
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
