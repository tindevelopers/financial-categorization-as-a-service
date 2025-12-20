/**
 * Supabase Storage Utilities for Financial Documents
 * Handles file uploads, downloads, and management in hot storage
 */

import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const BUCKET_NAME = "financial-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const ALLOWED_MIME_TYPES = [
  // PDF
  "application/pdf",
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
  // Text
  "text/plain",
];

export const FILE_TYPE_MAP: Record<string, string[]> = {
  bank_statement: ["application/pdf", "image/jpeg", "image/png", "image/tiff"],
  receipt: ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"],
  invoice: ["application/pdf", "image/jpeg", "image/png"],
  tax_document: ["application/pdf", "image/jpeg", "image/png", "image/tiff"],
  other: ALLOWED_MIME_TYPES,
};

export interface UploadResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  fileHash?: string;
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  fileExtension?: string;
}

/**
 * Validate a file before upload
 */
export function validateFile(
  file: File,
  fileType?: string
): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: PDF, images, spreadsheets, Word documents`,
    };
  }

  // Check MIME type against file type if specified
  if (fileType && fileType in FILE_TYPE_MAP) {
    const allowedForType = FILE_TYPE_MAP[fileType];
    if (!allowedForType.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not valid for ${fileType}`,
      };
    }
  }

  // Get file extension
  const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

  return {
    valid: true,
    mimeType: file.type,
    fileExtension,
  };
}

/**
 * Calculate SHA-256 hash of a file buffer
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate storage path for a document
 * Format: {userId}/{entityId}/{timestamp}-{filename}
 */
export function generateStoragePath(
  userId: string,
  entityId: string | null,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const entityFolder = entityId || "unassigned";
  return `${userId}/${entityFolder}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadToSupabase(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  entityId: string | null
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Read file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Calculate hash for deduplication
    const fileHash = calculateFileHash(fileBuffer);

    // Generate storage path
    const storagePath = generateStoragePath(userId, entityId, file.name);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    // Get signed URL for private access
    const { data: signedUrlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    return {
      success: true,
      path: storagePath,
      publicUrl: signedUrlData?.signedUrl,
      fileHash,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Download a file from Supabase Storage
 */
export async function downloadFromSupabase(
  supabase: SupabaseClient,
  storagePath: string
): Promise<{ success: boolean; data?: Blob; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

/**
 * Get a signed URL for temporary access to a file
 */
export async function getSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate URL",
    };
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFromSupabase(
  supabase: SupabaseClient,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Check if a file exists in Supabase Storage
 */
export async function fileExistsInSupabase(
  supabase: SupabaseClient,
  storagePath: string
): Promise<boolean> {
  try {
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .list(storagePath.substring(0, storagePath.lastIndexOf("/")));
    
    const filename = storagePath.substring(storagePath.lastIndexOf("/") + 1);
    return data?.some(file => file.name === filename) ?? false;
  } catch {
    return false;
  }
}

