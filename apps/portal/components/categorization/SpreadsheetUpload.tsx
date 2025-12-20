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
  const startTime = Date.now();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:67',message:'handleUpload start',data:{fileName:file.name,fileSize:file.size,fileType:file.type},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

    try {
      const formData = new FormData();
      formData.append('file', file);

    const response = await fetch('/api/categorization/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:75',message:'handleUpload response',data:{status:response.status,ok:response.ok,durationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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

      // Wait a moment for processing to start, then redirect
      // In Phase 2, we'll add proper polling/status checking
      setTimeout(() => {
        if (data.jobId) {
          window.location.href = `/review/${data.jobId}`;
        }
      }, 1000);
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:96',message:'handleUpload error',data:{errorMessage:error?.message || 'unknown',durationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
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
    <div className="space-y-6">
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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            What happens next?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>We'll extract transaction data from your spreadsheet</li>
            <li>Transactions will be automatically categorized</li>
            <li>You can review and adjust categories before exporting</li>
            <li>Export to Google Sheets when ready</li>
          </ul>
        </div>
      )}
    </div>
  );
}
