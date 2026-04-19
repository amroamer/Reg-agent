"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { Document, DocumentUpdate } from "@/lib/types";
import MetadataForm, { type MetadataFormData } from "./MetadataForm";

interface EditMetadataModalProps {
  open: boolean;
  doc: Document | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditMetadataModal({
  open,
  doc,
  onClose,
  onSaved,
}: EditMetadataModalProps) {
  const [form, setForm] = useState<MetadataFormData>({
    source: "SAMA",
    document_number: "",
    title_en: "",
    title_ar: "",
    issue_date: "",
    effective_date: "",
    source_url: "",
    status: "indexed",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setForm({
        source: doc.source,
        document_number: doc.document_number || "",
        title_en: doc.title_en || "",
        title_ar: doc.title_ar || "",
        issue_date: doc.issue_date || "",
        effective_date: doc.effective_date || "",
        source_url: doc.source_url || "",
        status: doc.status,
      });
    }
  }, [doc]);

  if (!open || !doc) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: DocumentUpdate = {
        title_en: form.title_en || null,
        title_ar: form.title_ar || null,
        document_number: form.document_number || null,
        issue_date: form.issue_date || null,
        effective_date: form.effective_date || null,
        source_url: form.source_url || null,
        status: form.status,
      };
      await api.patch(`/documents/${doc.id}`, payload);
      onSaved();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const ax = err as { response?: { data?: { detail?: string } } };
        setError(ax.response?.data?.detail || "Save failed");
      } else {
        setError("Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto py-8">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Edit Document Metadata</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <MetadataForm value={form} onChange={setForm} showStatus />

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
            ⚠ Changing Source or Document Number will not re-process the document.
            Use Re-process to re-run ingestion.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-kpmg-blue hover:bg-kpmg-blue-dark rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
