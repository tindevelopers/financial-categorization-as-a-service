"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowUpTrayIcon, DocumentIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  error: string | null;
  jobId: string | null;
}

export default function SpreadsheetUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    uploading: false,
    progress: 0,
    error: null,
    jobId: null,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setUploadState(prev => ({
        ...prev,
        error: 'Please upload a valid spreadsheet file (.xlsx, .xls, or .csv)',
      }));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadState(prev => ({
        ...prev,
        error: 'File size must be less than 10MB',
      }));
      return;
    }

    setUploadState(prev => ({
      ...prev,
      file,
      error: null,
    }));

    // Upload file
    await handleUpload(file);
  }, []);

  const handleUpload = async (file: File) => {
    setUploadState(prev => ({ ...prev, uploading: true, progress: 0 }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/categorization/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Upload failed');
      }

      const data = await response.json();
      
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        progress: 100,
        jobId: data.jobId,
      }));

      // Redirect to review page after successful upload
      if (data.jobId) {
        setTimeout(() => {
          window.location.href = `/review/${data.jobId}`;
        }, 1500);
      }
    } catch (error: any) {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: error.message || 'An error occurred during upload',
      }));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: uploadState.uploading,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Upload Your Bank Statement
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Upload your bank statement in CSV, XLS, or XLSX format. We&apos;ll automatically categorize your transactions.
        </p>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${uploadState.uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center">
          {uploadState.uploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Uploading... {uploadState.progress}%
              </p>
            </>
          ) : uploadState.file ? (
            <>
              <CheckCircleIcon className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {uploadState.file.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(uploadState.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {uploadState.jobId && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Upload successful! Redirecting...
                </p>
              )}
            </>
          ) : (
            <>
              <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your spreadsheet'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <DocumentIcon className="h-4 w-4" />
                <span>Supports .xlsx, .xls, .csv (max 10MB)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {uploadState.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Upload Error
            </p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              {uploadState.error}
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!uploadState.file && !uploadState.uploading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
            How it works
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2 list-disc list-inside">
            <li>Upload your bank statement export (CSV, XLS, or XLSX format)</li>
            <li>Our AI automatically categorizes each transaction</li>
            <li>Review and adjust categories if needed</li>
            <li>Export your categorized data back to Excel or CSV</li>
          </ul>
        </div>
      )}
    </div>
  );
}

