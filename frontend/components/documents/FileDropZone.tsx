"use client";

import { Upload, XCircle, FileText, CheckCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  multiple?: boolean;
  accept?: string;
  maxSizeMB?: number;
  currentFile?: File | null;
  onRemove?: () => void;
}

export default function FileDropZone({
  onFileSelected,
  multiple = false,
  accept = ".pdf",
  maxSizeMB = 50,
  currentFile,
  onRemove,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFileSelected(files[0]);
    },
    [onFileSelected],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) onFileSelected(files[0]);
    },
    [onFileSelected],
  );

  if (currentFile) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
            <FileText className="w-5 h-5 text-kpmg-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {currentFile.name}
            </p>
            <p className="text-xs text-gray-500">
              {(currentFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <CheckCircle className="w-5 h-5 text-green-500" />
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-white transition"
              title="Remove"
            >
              <XCircle className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-xl cursor-pointer transition ${
        dragOver
          ? "border-kpmg-blue bg-kpmg-blue/10"
          : "border-gray-300 hover:border-kpmg-blue hover:bg-kpmg-blue/5"
      }`}
    >
      <Upload className="w-10 h-10 text-gray-400 mb-3" />
      <p className="text-sm font-medium text-gray-700">
        Drag & drop {multiple ? "PDF files" : "a PDF file"} here, or click to
        browse
      </p>
      <p className="text-xs text-gray-400 mt-2">
        Accepted: {accept} • Max size: {maxSizeMB}MB
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
      />
    </label>
  );
}
