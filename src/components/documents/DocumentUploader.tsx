"use client";

import React, { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

interface DocumentUploaderProps {
  entityId?: string;
  onUploadComplete?: (documentId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  error?: string;
  documentId?: string;
}

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tiff",
  ".bmp",
  ".xlsx",
  ".xls",
  ".csv",
  ".docx",
  ".doc",
  ".txt",
];

const FILE_TYPE_OPTIONS = [
  { value: "bank_statement", label: "Bank Statement" },
  { value: "receipt", label: "Receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "tax_document", label: "Tax Document" },
  { value: "other", label: "Other" },
];

export default function DocumentUploader({
  entityId,
  onUploadComplete,
  onError,
  className = "",
}: DocumentUploaderProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [selectedFileType, setSelectedFileType] = useState("other");
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", selectedFileType);
    if (entityId) {
      formData.append("entityId", entityId);
    }

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      return { success: true, documentId: result.documentId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  };

  const processUploads = async (files: File[]) => {
    setIsUploading(true);

    // Initialize upload progress for all files
    const initialProgress: UploadProgress[] = files.map((file) => ({
      file,
      progress: 0,
      status: "pending",
    }));
    setUploads(initialProgress);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update status to uploading
      setUploads((prev) =>
        prev.map((u, idx) =>
          idx === i ? { ...u, status: "uploading", progress: 25 } : u
        )
      );

      // Simulate progress
      setUploads((prev) =>
        prev.map((u, idx) => (idx === i ? { ...u, progress: 50 } : u))
      );

      // Upload file
      const result = await uploadFile(file);

      // Update with result
      setUploads((prev) =>
        prev.map((u, idx) =>
          idx === i
            ? result.success
              ? {
                  ...u,
                  status: "completed",
                  progress: 100,
                  documentId: result.documentId,
                }
              : { ...u, status: "error", progress: 0, error: result.error }
            : u
        )
      );

      if (result.success && onUploadComplete) {
        onUploadComplete(result.documentId!);
      } else if (!result.success && onError) {
        onError(result.error || "Upload failed");
      }
    }

    setIsUploading(false);
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map(
          (r) =>
            `${r.file.name}: ${r.errors.map((e) => e.message).join(", ")}`
        );
        if (onError) {
          onError(errors.join("\n"));
        }
      }

      if (acceptedFiles.length > 0) {
        processUploads(acceptedFiles);
      }
    },
    [selectedFileType, entityId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".bmp"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isUploading,
  });

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "completed"));
  };

  const retryFailed = () => {
    const failedFiles = uploads
      .filter((u) => u.status === "error")
      .map((u) => u.file);
    if (failedFiles.length > 0) {
      processUploads(failedFiles);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Type Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Document Type:
        </label>
        <select
          value={selectedFileType}
          onChange={(e) => setSelectedFileType(e.target.value)}
          disabled={isUploading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          {FILE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drop Zone */}
      <div
        className={`transition border-2 border-dashed cursor-pointer rounded-xl ${
          isDragActive
            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
            : "border-gray-300 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500"
        } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div
          {...getRootProps()}
          className="flex flex-col items-center justify-center p-8 lg:p-12"
        >
          <input {...getInputProps()} />

          {/* Icon */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {isUploading ? (
              <svg
                className="h-8 w-8 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>

          {/* Text */}
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white">
            {isDragActive
              ? "Drop your documents here"
              : isUploading
              ? "Uploading..."
              : "Upload Financial Documents"}
          </h4>
          <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Drag and drop bank statements, receipts, invoices, or tax documents
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Supported: PDF, Images, Excel, CSV, Word (max 50MB)
          </p>
          {!isUploading && (
            <button
              type="button"
              className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              Browse Files
            </button>
          )}
        </div>
      </div>

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uploads ({uploads.filter((u) => u.status === "completed").length}/
              {uploads.length})
            </h5>
            <div className="flex gap-2">
              {uploads.some((u) => u.status === "error") && (
                <button
                  onClick={retryFailed}
                  className="text-xs text-brand-500 hover:text-brand-600"
                >
                  Retry Failed
                </button>
              )}
              {uploads.some((u) => u.status === "completed") && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear Completed
                </button>
              )}
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0 dark:border-gray-800"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {upload.status === "completed" && (
                    <svg
                      className="h-5 w-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {upload.status === "error" && (
                    <svg
                      className="h-5 w-5 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                  {(upload.status === "uploading" ||
                    upload.status === "processing") && (
                    <svg
                      className="h-5 w-5 animate-spin text-brand-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                  )}
                  {upload.status === "pending" && (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white">
                    {upload.file.name}
                  </p>
                  {upload.error && (
                    <p className="truncate text-xs text-red-500">
                      {upload.error}
                    </p>
                  )}
                  {upload.status === "completed" && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      OCR processing started
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                {(upload.status === "uploading" ||
                  upload.status === "processing") && (
                  <div className="w-20">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full bg-brand-500 transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

