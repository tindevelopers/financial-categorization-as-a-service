/**
 * Structured error codes for categorization jobs
 * Maps error codes to user-friendly messages and metadata
 */

export type JobErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "PROCESSING_FAILED"
  | "DOWNLOAD_FAILED"
  | "PARSING_ERROR"
  | "OCR_FAILED"
  | "TIMEOUT"
  | "UNKNOWN_ERROR"
  | "DUPLICATE_FILE"
  | "STORAGE_ERROR"
  | "STORAGE_BUCKET_MISSING"
  | "AUTHENTICATION_ERROR";

export interface JobError {
  code: JobErrorCode;
  message: string;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
  suggestedAction?: string;
}

export const JOB_ERRORS: Record<JobErrorCode, Omit<JobError, "code">> = {
  FILE_TOO_LARGE: {
    message: "File size exceeds maximum allowed size",
    userMessage: "File is too large. Please upload a file smaller than 10MB.",
    statusCode: 400,
    retryable: true,
    suggestedAction: "Try uploading a smaller file",
  },
  INVALID_FILE_TYPE: {
    message: "Invalid file type or format",
    userMessage: "This file type is not supported. Please upload a supported format.",
    statusCode: 400,
    retryable: true,
    suggestedAction: "Check the file format and try again",
  },
  UPLOAD_FAILED: {
    message: "Failed to upload file to storage",
    userMessage: "We couldn't save your file. Please try again.",
    statusCode: 500,
    retryable: true,
    suggestedAction: "Check your internet connection and try again",
  },
  PROCESSING_FAILED: {
    message: "File processing failed",
    userMessage: "We couldn't process your file. Please check the file format and try again.",
    statusCode: 500,
    retryable: true,
    suggestedAction: "Verify the file is not corrupted and try again",
  },
  DOWNLOAD_FAILED: {
    message: "Failed to download file from storage",
    userMessage: "We couldn't retrieve your file for processing. Please try uploading again.",
    statusCode: 500,
    retryable: true,
    suggestedAction: "Try uploading the file again",
  },
  PARSING_ERROR: {
    message: "Failed to parse spreadsheet file",
    userMessage: "We couldn't read your spreadsheet. Please check the file format.",
    statusCode: 400,
    retryable: true,
    suggestedAction: "Ensure the file is a valid Excel or CSV file",
  },
  OCR_FAILED: {
    message: "OCR processing failed",
    userMessage: "We couldn't extract text from your document. Please try a clearer image or PDF.",
    statusCode: 500,
    retryable: true,
    suggestedAction: "Try uploading a clearer image or PDF",
  },
  TIMEOUT: {
    message: "Processing timeout",
    userMessage: "Processing took too long. Please try again with a smaller file.",
    statusCode: 504,
    retryable: true,
    suggestedAction: "Try uploading a smaller file or split into multiple files",
  },
  UNKNOWN_ERROR: {
    message: "An unexpected error occurred",
    userMessage: "Something went wrong. Please try again or contact support if the problem persists.",
    statusCode: 500,
    retryable: true,
    suggestedAction: "Try again in a few moments",
  },
  DUPLICATE_FILE: {
    message: "File already exists",
    userMessage: "This file has already been uploaded. Please upload a different file.",
    statusCode: 409,
    retryable: false,
    suggestedAction: "Upload a different file or delete the existing one first",
  },
  STORAGE_ERROR: {
    message: "Storage service error",
    userMessage: "We couldn't access storage. Please try again.",
    statusCode: 503,
    retryable: true,
    suggestedAction: "Try again in a few moments",
  },
  STORAGE_BUCKET_MISSING: {
    message: "Storage bucket not found",
    userMessage:
      "Storage is not set up yet (missing bucket). Please run the Supabase migrations or create the 'categorization-uploads' bucket in Supabase Storage, then try again.",
    statusCode: 500,
    retryable: false,
    suggestedAction:
      "Apply `supabase/migrations/20251219020001_create_storage_bucket.sql` to your Supabase project (or create the bucket in the dashboard)",
  },
  AUTHENTICATION_ERROR: {
    message: "Authentication failed",
    userMessage: "Your session has expired. Please log in again.",
    statusCode: 401,
    retryable: false,
    suggestedAction: "Please log in and try again",
  },
};

/**
 * Get error details by code
 */
export function getJobError(code: JobErrorCode): JobError {
  return {
    code,
    ...JOB_ERRORS[code],
  };
}

/**
 * Create a job error response
 */
export function createJobErrorResponse(
  code: JobErrorCode,
  customMessage?: string
): {
  error_code: JobErrorCode;
  error_message: string;
  status_message: string;
  suggested_action?: string;
} {
  const error = getJobError(code);
  return {
    error_code: code,
    error_message: customMessage || error.message,
    status_message: error.userMessage,
    suggested_action: error.suggestedAction,
  };
}

/**
 * Map an error to an appropriate error code
 */
export function mapErrorToCode(error: any): JobErrorCode {
  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code?.toLowerCase() || "";

  // Specific storage bootstrap error: bucket doesn't exist
  if (errorMessage.includes("bucket not found")) {
    return "STORAGE_BUCKET_MISSING";
  }

  // File size errors
  if (
    errorMessage.includes("size") ||
    errorMessage.includes("too large") ||
    errorMessage.includes("exceeds")
  ) {
    return "FILE_TOO_LARGE";
  }

  // File type errors
  if (
    errorMessage.includes("invalid") ||
    errorMessage.includes("file type") ||
    errorMessage.includes("format") ||
    errorMessage.includes("unsupported")
  ) {
    return "INVALID_FILE_TYPE";
  }

  // Upload errors
  if (
    errorMessage.includes("upload") ||
    errorCode.includes("storage") ||
    errorMessage.includes("save")
  ) {
    return "UPLOAD_FAILED";
  }

  // Download errors
  if (
    errorMessage.includes("download") ||
    errorMessage.includes("retrieve") ||
    errorMessage.includes("fetch")
  ) {
    return "DOWNLOAD_FAILED";
  }

  // Parsing errors
  if (
    errorMessage.includes("parse") ||
    errorMessage.includes("read") ||
    errorMessage.includes("invalid format")
  ) {
    return "PARSING_ERROR";
  }

  // OCR errors
  if (
    errorMessage.includes("ocr") ||
    errorMessage.includes("extract") ||
    errorMessage.includes("document ai")
  ) {
    return "OCR_FAILED";
  }

  // Timeout errors
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    errorCode.includes("timeout")
  ) {
    return "TIMEOUT";
  }

  // Authentication errors
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("auth") ||
    errorCode.includes("401")
  ) {
    return "AUTHENTICATION_ERROR";
  }

  // Storage errors
  if (
    errorMessage.includes("storage") ||
    errorCode.includes("storage") ||
    errorMessage.includes("bucket")
  ) {
    return "STORAGE_ERROR";
  }

  // Default to unknown
  return "UNKNOWN_ERROR";
}



