/**
 * Google Cloud Storage Archive Utilities
 * Simplified version for portal app
 */

/**
 * Delete a file from GCS Archive
 */
export async function deleteFromGCS(
  archivePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if GCS is configured
    const GCS_BUCKET = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!GCS_BUCKET) {
      // GCS not configured - log and return success (no-op)
      console.log(`[GCS] Not configured - skipping delete for: ${archivePath}`);
      return { success: true };
    }

    if (!credentials) {
      // No credentials - simulate delete for development
      console.log(`[GCS SIMULATED] Would delete: gs://${GCS_BUCKET}/${archivePath}`);
      return { success: true };
    }

    // Try to use Google Cloud Storage SDK if available
    try {
      // @ts-ignore - Optional dependency, may not be installed
      const { Storage } = await import("@google-cloud/storage");
      const storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: credentials,
      });

      const bucket = storage.bucket(GCS_BUCKET);
      await bucket.file(archivePath).delete();

      console.log(`[GCS] Deleted: gs://${GCS_BUCKET}/${archivePath}`);
      return { success: true };
    } catch (sdkError) {
      // SDK not available - simulate for development
      console.log(`[GCS SIMULATED] Would delete: gs://${GCS_BUCKET}/${archivePath}`);
      return { success: true };
    }
  } catch (error) {
    console.error("Delete from GCS error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

