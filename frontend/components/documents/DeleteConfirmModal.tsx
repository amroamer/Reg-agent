"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  documentTitle: string;
  documentNumber: string;
  stats: {
    pages: number;
    articles: number;
    chunks: number;
  };
}

export default function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  documentTitle,
  documentNumber,
  stats,
}: DeleteConfirmModalProps) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const canDelete = typed.trim() === documentNumber.trim() && !deleting;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
      setTyped("");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-gray-900">Delete Document</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this document?
          </p>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">{documentTitle}</p>
            <p className="text-xs text-gray-500 font-mono">{documentNumber}</p>
          </div>

          <div className="text-sm text-gray-600">
            <p className="mb-1">This will permanently remove:</p>
            <ul className="list-disc ps-5 space-y-0.5 text-xs">
              <li>The original PDF file</li>
              <li>{stats.articles} parsed articles</li>
              <li>{stats.chunks} vector embeddings from the search index</li>
              <li>The generated JSON and Markdown files</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700">This action cannot be undone.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type the document number to confirm:
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={documentNumber}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:border-red-500 focus:outline-none"
            />
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
            onClick={handleConfirm}
            disabled={!canDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "Delete Document"}
          </button>
        </div>
      </div>
    </div>
  );
}
