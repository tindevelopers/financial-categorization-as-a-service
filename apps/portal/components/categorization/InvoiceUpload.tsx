"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { 
  ArrowUpTrayIcon, 
  DocumentIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  CloudArrowUpIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

interface UploadState {
  files: File[];
  uploading: boolean;
  progress: number;
  error: string | null;
  jobId: string | null;
  cloudStorageConnected: {
    dropbox: boolean;
    google_drive: boolean;
  };
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_type: string;
  default_spreadsheet_id: string | null;
}

export default function InvoiceUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    files: [],
    uploading: false,
    progress: 0,
    error: null,
    jobId: null,
    cloudStorageConnected: {
      dropbox: false,
      google_drive: false,
    },
  });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    checkCloudStorageConnections();
    fetchBankAccounts();
    fetchProfileStatus();
  }, []);

  const checkCloudStorageConnections = async () => {
    try {
      const response = await fetch("/api/storage/status");
      if (response.ok) {
        const data = await response.json();
        setUploadState(prev => ({
          ...prev,
          cloudStorageConnected: {
            dropbox: data.dropbox || false,
            google_drive: data.google_drive || false,
          },
        }));
      }
    } catch (error) {
      // Ignore errors, assume not connected
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch("/api/bank-accounts");
      const data = await response.json();
      if (data.success && data.bank_accounts) {
        setBankAccounts(data.bank_accounts);
        if (data.bank_accounts.length === 1) {
          setSelectedBankAccountId(data.bank_accounts[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    } finally {
      setLoadingBankAccounts(false);
    }
  };

  const fetchProfileStatus = async () => {
    try {
      const response = await fetch("/api/company");
      if (response.ok) {
        const data = await response.json();
        const companies = data.companies || [];
        const hasName = companies.some((c: any) => c.company_name);
        setProfileReady(hasName);
      } else {
        setProfileReady(false);
      }
    } catch {
      setProfileReady(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Validate file types
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    
    const invalidFiles = acceptedFiles.filter(
      file => !validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)
    );

    if (invalidFiles.length > 0) {
      setUploadState(prev => ({
        ...prev,
        error: `Invalid file types. Please upload JPG, PNG, or PDF files only.`,
      }));
      return;
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = acceptedFiles.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
      setUploadState(prev => ({
        ...prev,
        error: `Some files exceed 10MB limit: ${oversizedFiles.map(f => f.name).join(", ")}`,
      }));
      return;
    }

    setUploadState(prev => ({
      ...prev,
      files: [...prev.files, ...acceptedFiles],
      error: null,
    }));
  }, []);

  const handleUpload = async () => {
    if (uploadState.files.length === 0) {
      setUploadState(prev => ({ ...prev, error: "Please select at least one file" }));
      return;
    }

    if (!profileReady && !profileLoading) {
      setUploadState(prev => ({ ...prev, error: "Please complete your profile (individual/company name) before uploading." }));
      return;
    }

    if (!selectedBankAccountId) {
      setUploadState(prev => ({ ...prev, error: "Please select a bank account before uploading." }));
      return;
    }

    const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId);
    if (selectedAccount && !selectedAccount.default_spreadsheet_id) {
      setUploadState(prev => ({ ...prev, error: "Please set a default spreadsheet for this bank account before uploading." }));
      return;
    }

    setUploadState(prev => ({ ...prev, uploading: true, progress: 0 }));

    try {
      const formData = new FormData();
      uploadState.files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      formData.append("fileCount", uploadState.files.length.toString());
      formData.append("bank_account_id", selectedBankAccountId);

      const response = await fetch("/api/categorization/upload-invoices", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error || errorData.message || "Upload failed");
        (error as any).data = errorData;
        throw error;
      }

      const data = await response.json();
      
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        progress: 100,
        jobId: data.jobId,
      }));

      // Redirect to uploads page to see processing status
      if (data.jobId) {
        setTimeout(() => {
          window.location.href = `/dashboard/uploads`;
        }, 1500);
      }
    } catch (error: any) {
      // Try to extract error message from response
      let errorMessage = error.message || "An error occurred during upload";
      if (error.data) {
        if (error.data.status_message) {
          errorMessage = error.data.status_message;
        } else if (error.data.error) {
          errorMessage = error.data.error;
        }
      }
      
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: errorMessage,
      }));
    }
  };

  const handleConnectDropbox = () => {
    window.location.href = "/api/storage/dropbox/connect";
  };

  const handleConnectGoogleDrive = () => {
    window.location.href = "/api/storage/drive/connect";
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
    disabled: uploadState.uploading,
  });

  return (
    <div className="space-y-6">
      {/* Cloud Storage Connection Status */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              Cloud Storage (Optional)
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Connect your cloud storage to automatically sync invoices after processing.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConnectDropbox}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                uploadState.cloudStorageConnected.dropbox
                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                  : "bg-white text-blue-700 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
              }`}
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              {uploadState.cloudStorageConnected.dropbox ? "Dropbox ✓" : "Connect Dropbox"}
            </button>
            <button
              onClick={handleConnectGoogleDrive}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                uploadState.cloudStorageConnected.google_drive
                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                  : "bg-white text-blue-700 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
              }`}
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              {uploadState.cloudStorageConnected.google_drive ? "Drive ✓" : "Connect Drive"}
            </button>
          </div>
        </div>
      </div>

      {/* Profile and Bank Account requirements */}
      {!profileLoading && !profileReady && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please complete your profile (individual/company name) before uploading.
            <a href="/dashboard/settings" className="underline ml-1">Go to settings</a>
          </p>
        </div>
      )}

      {!uploadState.uploading && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Bank Account <span className="text-red-500">*</span>
          </label>
          {loadingBankAccounts ? (
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded-lg"></div>
          ) : bankAccounts.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No bank accounts found. Please <a href="/dashboard/settings/bank-accounts" className="underline">create a bank account</a> first.
              </p>
            </div>
          ) : (
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select Bank Account --</option>
              {bankAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.account_name} ({account.bank_name})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }
          ${uploadState.uploading ? "opacity-50 cursor-not-allowed" : ""}
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
          ) : uploadState.files.length > 0 ? (
            <>
              <CheckCircleIcon className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {uploadState.files.length} file{uploadState.files.length > 1 ? "s" : ""} selected
              </p>
              <div className="space-y-1 mb-4">
                {uploadState.files.map((file, index) => (
                  <p key={index} className="text-sm text-gray-500 dark:text-gray-400">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                ))}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload & Process
              </button>
            </>
          ) : (
            <>
              <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {isDragActive ? "Drop your invoices here" : "Drag & drop your invoices"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <DocumentIcon className="h-4 w-4" />
                <span>Supports .jpg, .png, .pdf (max 10MB each)</span>
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
      {uploadState.files.length === 0 && !uploadState.uploading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            What happens next?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>We'll extract data from your invoices using OCR</li>
            <li>Transactions will be automatically categorized</li>
            <li>You can review and adjust categories before exporting</li>
            <li>Export to Google Sheets when ready</li>
          </ul>
        </div>
      )}
    </div>
  );
}
