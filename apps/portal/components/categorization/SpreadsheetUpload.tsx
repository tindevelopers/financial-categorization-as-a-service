"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import { ArrowUpTrayIcon, DocumentIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";

interface DuplicateInfo {
  existingJobId?: string;
  existingDocumentId?: string;
  warnings?: string[];
  matchType?: 'exact' | 'filename_date' | 'content_similarity';
  existingFilename?: string;
  uploadDate?: string;
}

interface DuplicatePreview {
  similarityScore: number;
  matchingCount: number;
  totalTransactions: number;
}

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  error: string | null;
  jobId: string | null;
  isDuplicate: boolean;
  duplicateInfo: DuplicateInfo | null;
  duplicatePreview: DuplicatePreview | null;
  warnings: string[];
}

interface BankAccount {
  id: string;
  account_name: string;
  account_type: string;
  bank_name: string;
  default_spreadsheet_id: string | null;
  spreadsheet_tab_name: string | null;
}

export default function SpreadsheetUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    uploading: false,
    progress: 0,
    error: null,
    jobId: null,
    isDuplicate: false,
    duplicateInfo: null,
    duplicatePreview: null,
    warnings: [],
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  
  // Wrapper to ensure we always set a string value and log if something goes wrong
  const setSelectedBankAccountIdSafe = (value: any) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:59',message:'setSelectedBankAccountIdSafe called',data:{value,valueType:typeof value,isString:typeof value === 'string',isObject:typeof value === 'object',stringValue:String(value)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    
    if (typeof value === 'string') {
      setSelectedBankAccountId(value);
    } else if (value && typeof value === 'object') {
      console.error('Attempted to set selectedBankAccountId to an object:', value);
      // Try to extract id if it's a bank account object
      if ('id' in value && typeof value.id === 'string') {
        console.warn('Extracting id from bank account object:', value.id);
        setSelectedBankAccountId(value.id);
      } else {
        setSelectedBankAccountId('');
      }
    } else {
      setSelectedBankAccountId(String(value || ''));
    }
  };
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch bank accounts on mount
  React.useEffect(() => {
    fetchBankAccounts();
    fetchProfileStatus();
  }, []);

  const fetchBankAccounts = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:69',message:'fetchBankAccounts start',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    try {
      const response = await fetch("/api/bank-accounts");
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:72',message:'fetchBankAccounts response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      const data = await response.json();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:75',message:'fetchBankAccounts data parsed',data:{hasSuccess:data.success,hasBankAccounts:!!data.bank_accounts,bankAccountsCount:data.bank_accounts?.length || 0,hasError:!!data.error,error:data.error || null,bankAccountIds:data.bank_accounts?.map((ba:any)=>ba.id) || []},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      if (data.success && data.bank_accounts) {
        setBankAccounts(data.bank_accounts);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:79',message:'fetchBankAccounts - setting bank accounts',data:{bankAccountsCount:data.bank_accounts.length,willAutoSelect:data.bank_accounts.length === 1,autoSelectedId:data.bank_accounts.length === 1 ? data.bank_accounts[0].id : null},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        // Auto-select first account if only one exists
        if (data.bank_accounts.length === 1 && data.bank_accounts[0].id) {
          // Ensure we set a string value - validate it's actually a string
          const accountId = data.bank_accounts[0].id;
          if (typeof accountId === 'string') {
            setSelectedBankAccountIdSafe(accountId);
          } else {
            console.error('Auto-select failed: account id is not a string:', accountId, typeof accountId);
            setSelectedBankAccountIdSafe('');
          }
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:85',message:'fetchBankAccounts - invalid response',data:{hasSuccess:data.success,hasBankAccounts:!!data.bank_accounts,error:data.error || null},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:90',message:'fetchBankAccounts - exception',data:{errorMessage:error?.message || 'unknown',errorType:error?.constructor?.name || 'unknown',errorStack:error?.stack?.substring(0,200) || null},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error("Error fetching bank accounts:", error);
    } finally {
      setLoadingBankAccounts(false);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:95',message:'fetchBankAccounts - finally',data:{loadingBankAccounts:false},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
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

  const selectedBankAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId);

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:171',message:'handleUpload entry',data:{selectedBankAccountId,selectedBankAccountIdType:typeof selectedBankAccountId,isString:typeof selectedBankAccountId === 'string',isObject:typeof selectedBankAccountId === 'object',bankAccountsCount:bankAccounts.length},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    
    // Gating checks
    if (!profileReady && !profileLoading) {
      setUploadState(prev => ({ ...prev, error: "Please complete your profile (individual/company name) before uploading." }));
      return;
    }
    // Validate bank account selection - check both empty string and falsy values
    // Ensure selectedBankAccountId is a string and not an object
    let bankAccountId: string = '';
    if (typeof selectedBankAccountId === 'string') {
      bankAccountId = selectedBankAccountId;
    } else if (selectedBankAccountId && typeof selectedBankAccountId === 'object') {
      // If it's an object, try to extract an id property, otherwise log error
      console.error('Bank account validation failed: selectedBankAccountId is an object:', selectedBankAccountId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:186',message:'Bank account is object - validation failed',data:{selectedBankAccountId,selectedBankAccountIdType:typeof selectedBankAccountId,hasId:selectedBankAccountId && 'id' in selectedBankAccountId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      setUploadState(prev => ({ ...prev, error: "Please select a bank account before uploading." }));
      return;
    } else {
      bankAccountId = String(selectedBankAccountId || '');
    }
    
    if (!bankAccountId || bankAccountId.trim() === '' || bankAccountId === '[object Object]') {
      console.error('Bank account validation failed:', { selectedBankAccountId, bankAccountId, bankAccountsCount: bankAccounts.length, type: typeof selectedBankAccountId, isObjectString: bankAccountId === '[object Object]' });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:194',message:'Bank account validation failed - empty or object string',data:{selectedBankAccountId,bankAccountId,isObjectString:bankAccountId === '[object Object]',bankAccountsCount:bankAccounts.length},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      setUploadState(prev => ({ ...prev, error: "Please select a bank account before uploading." }));
      return;
    }
    if (selectedBankAccount && !selectedBankAccount.default_spreadsheet_id) {
      setUploadState(prev => ({ ...prev, error: "Please set a default spreadsheet for this bank account before uploading." }));
      return;
    }

    setUploadState(prev => ({ ...prev, uploading: true, progress: 0 }));
  const startTime = Date.now();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:67',message:'handleUpload start',data:{fileName:file.name,fileSize:file.size,fileType:file.type},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

    try {
      // Validate bank account selection again (double-check)
      // Ensure selectedBankAccountId is a string and not an object
      let bankAccountId: string = '';
      if (typeof selectedBankAccountId === 'string') {
        bankAccountId = selectedBankAccountId;
      } else if (selectedBankAccountId && typeof selectedBankAccountId === 'object') {
        // If it's an object, try to extract an id property, otherwise log error
        console.error('Bank account validation failed in try block: selectedBankAccountId is an object:', selectedBankAccountId);
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          error: 'Please select a bank account before uploading',
        }));
        return;
      } else {
        bankAccountId = String(selectedBankAccountId || '');
      }
      
      if (!bankAccountId || bankAccountId.trim() === '' || bankAccountId === '[object Object]') {
        console.error('Bank account validation failed in try block:', { selectedBankAccountId, bankAccountId, type: typeof selectedBankAccountId, isObjectString: bankAccountId === '[object Object]' });
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          error: 'Please select a bank account before uploading',
        }));
        return;
      }

      console.log('Uploading with bank account:', bankAccountId);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bank_account_id', bankAccountId);
      
      // Add spreadsheet_id and spreadsheet_tab_id if bank account has defaults
      // Re-find selected bank account using the validated bankAccountId
      const validatedSelectedBankAccount = bankAccounts.find(acc => acc.id === bankAccountId);
      if (validatedSelectedBankAccount) {
        if (validatedSelectedBankAccount.default_spreadsheet_id) {
          formData.append('spreadsheet_id', validatedSelectedBankAccount.default_spreadsheet_id);
        }
        if (validatedSelectedBankAccount.spreadsheet_tab_name) {
          formData.append('spreadsheet_tab_id', validatedSelectedBankAccount.spreadsheet_tab_name);
        }
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 90); // Reserve 10% for processing
          setUploadState(prev => ({ ...prev, progress: percentComplete }));
        }
      });

      // Handle completion
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Invalid response from server'));
            }
          } else if (xhr.status === 409) {
            // Duplicate file detected - resolve with special flag
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({ ...data, isDuplicateError: true });
            } catch (e) {
              reject(new Error('Duplicate file detected'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || error.message || 'Upload failed'));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/categorization/upload');
        xhr.send(formData);
      });

      const data = await uploadPromise;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:75',message:'handleUpload response',data:{status:200,ok:true,durationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

      // Handle duplicate file detection (409 response)
      if (data.isDuplicateError) {
        setPendingFile(file);
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          progress: 0,
          isDuplicate: true,
          duplicateInfo: {
            existingJobId: data.existingJobId,
            existingDocumentId: data.existingDocumentId,
            matchType: 'exact',
          },
          error: null,
        }));
        return;
      }
      
      // Set to 100% when done
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        progress: 100,
        jobId: data.jobId,
        warnings: data.warnings || [],
        duplicatePreview: data.duplicatePreview || null,
      }));

      // Show success message and redirect to uploads page to see status
      if (data.jobId) {
        // Redirect to uploads page where user can see the processing status
        // Add a timestamp to force refresh
        setTimeout(() => {
          window.location.href = `/dashboard/uploads?refresh=${Date.now()}`;
        }, 1500);
      }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetUpload.tsx:96',message:'handleUpload error',data:{errorMessage:error?.message || 'unknown',durationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
      // Try to extract error message from response
      let errorMessage = error.message || 'An error occurred during upload';
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.status_message) {
          errorMessage = errorData.status_message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Use the error message as-is
      }
      
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: errorMessage,
      }));
    }
  };

  const handleForceUpload = async () => {
    if (!pendingFile) return;
    if (!profileReady && !profileLoading) {
      setUploadState(prev => ({ ...prev, error: "Please complete your profile (individual/company name) before uploading." }));
      return;
    }
    // Ensure selectedBankAccountId is a string
    const bankAccountId = typeof selectedBankAccountId === 'string' ? selectedBankAccountId : String(selectedBankAccountId || '');
    if (!bankAccountId || bankAccountId.trim() === '') {
      setUploadState(prev => ({ ...prev, error: "Please select a bank account before uploading." }));
      return;
    }
    const validatedSelectedBankAccount = bankAccounts.find(acc => acc.id === bankAccountId);
    if (validatedSelectedBankAccount && !validatedSelectedBankAccount.default_spreadsheet_id) {
      setUploadState(prev => ({ ...prev, error: "Please set a default spreadsheet for this bank account before uploading." }));
      return;
    }
    
    setUploadState(prev => ({ 
      ...prev, 
      uploading: true, 
      progress: 0, 
      isDuplicate: false, 
      duplicateInfo: null,
      error: null,
    }));

    try {
      if (!bankAccountId || bankAccountId.trim() === '') {
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          error: 'Please select a bank account before uploading',
        }));
        return;
      }

      const formData = new FormData();
      formData.append('file', pendingFile);
      formData.append('force', 'true');
      // Only append bank_account_id if it's not empty
      if (bankAccountId && bankAccountId.trim() !== '') {
        formData.append('bank_account_id', bankAccountId);
      }
      
      if (validatedSelectedBankAccount) {
        if (validatedSelectedBankAccount.default_spreadsheet_id) {
          formData.append('spreadsheet_id', validatedSelectedBankAccount.default_spreadsheet_id);
        }
        if (validatedSelectedBankAccount.spreadsheet_tab_name) {
          formData.append('spreadsheet_tab_id', validatedSelectedBankAccount.spreadsheet_tab_name);
        }
      }

      const response = await fetch('/api/categorization/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadState(prev => ({
        ...prev,
        uploading: false,
        progress: 100,
        jobId: data.jobId,
        warnings: data.warnings || [],
        duplicatePreview: data.duplicatePreview || null,
      }));

      setPendingFile(null);

      if (data.jobId) {
        setTimeout(() => {
          window.location.href = `/dashboard/uploads?refresh=${Date.now()}`;
        }, 1500);
      }
    } catch (error: any) {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: error.message || 'Upload failed',
      }));
    }
  };

  const handleCancelDuplicate = () => {
    setPendingFile(null);
    setUploadState({
      file: null,
      uploading: false,
      progress: 0,
      error: null,
      jobId: null,
      isDuplicate: false,
      duplicateInfo: null,
      duplicatePreview: null,
      warnings: [],
    });
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
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Uploading {uploadState.file?.name}...
              </p>
              <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {uploadState.progress}% complete
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

      {/* Duplicate File Detected */}
      {uploadState.isDuplicate && uploadState.duplicateInfo && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <DocumentDuplicateIcon className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Duplicate File Detected
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                This file has already been uploaded. You can view the existing upload or upload it again.
              </p>
              
              {uploadState.duplicateInfo.existingJobId && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href={`/dashboard/uploads`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
                  >
                    <DocumentIcon className="h-4 w-4" />
                    View Existing File
                  </Link>
                  <button
                    onClick={handleForceUpload}
                    disabled={uploadState.uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploadState.uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        Upload Anyway
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelDuplicate}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Warnings (e.g., duplicate transactions) */}
      {uploadState.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Upload completed with warnings
            </p>
            <ul className="text-sm text-yellow-600 dark:text-yellow-300 mt-1 list-disc list-inside">
              {uploadState.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Bank Account Selection */}
      {!uploadState.uploading && (
        <div className="mb-6">
          {!profileLoading && !profileReady && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please complete your profile (individual/company name) before uploading.
                <Link href="/dashboard/settings" className="underline ml-1">Go to settings</Link>
              </p>
            </div>
          )}
          <label htmlFor="bank-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Bank Account <span className="text-red-500">*</span>
          </label>
          {loadingBankAccounts ? (
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded-lg"></div>
          ) : bankAccounts.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No bank accounts found. Please <Link href="/dashboard/settings/bank-accounts" className="underline">create a bank account</Link> first.
              </p>
            </div>
          ) : (
            <>
              <select
                id="bank-account"
                name="bank-account"
                value={typeof selectedBankAccountId === 'string' ? selectedBankAccountId : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  console.log('Bank account selected:', value, 'type:', typeof value, 'event target:', e.target);
                  // Use safe setter to ensure we always set a string value
                  setSelectedBankAccountIdSafe(value);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">-- Select Bank Account --</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} ({account.bank_name}) - {account.account_type}
                  </option>
                ))}
              </select>
              {selectedBankAccount && selectedBankAccount.default_spreadsheet_id && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Will sync to spreadsheet: {selectedBankAccount.default_spreadsheet_id}
                  {selectedBankAccount.spreadsheet_tab_name && ` (Tab: ${selectedBankAccount.spreadsheet_tab_name})`}
                </p>
              )}
            </>
          )}
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
