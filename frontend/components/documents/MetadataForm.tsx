"use client";

import type { DocumentStatus, SourceAuthority } from "@/lib/types";

export interface MetadataFormData {
  source: SourceAuthority;
  document_number: string;
  title_en: string;
  title_ar: string;
  issue_date: string;
  effective_date: string;
  source_url: string;
  status?: DocumentStatus;
}

interface MetadataFormProps {
  value: MetadataFormData;
  onChange: (next: MetadataFormData) => void;
  showStatus?: boolean;
}

export default function MetadataForm({
  value,
  onChange,
  showStatus = false,
}: MetadataFormProps) {
  const update = (k: keyof MetadataFormData, v: string) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-6">
      {/* Required fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Required</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source <span className="text-red-500">*</span>
            </label>
            <select
              value={value.source}
              onChange={(e) => update("source", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
            >
              <option value="SAMA">SAMA</option>
              <option value="CMA">CMA</option>
              <option value="BANK_POLICY">Bank Policy</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Regulatory authority</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Number
            </label>
            <input
              type="text"
              value={value.document_number}
              onChange={(e) => update("document_number", e.target.value)}
              placeholder="e.g., SAMA/LAW/BCL-M-5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Auto-detected from file</p>
          </div>
        </div>
      </div>

      {/* Titles */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Document Title</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (English)
            </label>
            <input
              type="text"
              value={value.title_en}
              onChange={(e) => update("title_en", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (Arabic)
            </label>
            <input
              type="text"
              value={value.title_ar}
              onChange={(e) => update("title_ar", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none font-arabic"
              dir="rtl"
            />
          </div>
        </div>
      </div>

      {/* Dates + status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Dates & Status</h3>
        <div className={`grid ${showStatus ? "grid-cols-3" : "grid-cols-2"} gap-4`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue Date
            </label>
            <input
              type="date"
              value={value.issue_date}
              onChange={(e) => update("issue_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective Date
            </label>
            <input
              type="date"
              value={value.effective_date}
              onChange={(e) => update("effective_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
            />
          </div>
          {showStatus && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={value.status || "indexed"}
                onChange={(e) => update("status", e.target.value as DocumentStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
              >
                <option value="indexed">Active</option>
                <option value="superseded">Superseded</option>
              </select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source URL (optional)
          </label>
          <input
            type="url"
            value={value.source_url}
            onChange={(e) => update("source_url", e.target.value)}
            placeholder="https://sama.gov.sa/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-kpmg-blue focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
