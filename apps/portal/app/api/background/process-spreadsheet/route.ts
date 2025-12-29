import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { processSpreadsheetFile } from "@/lib/categorization/process-spreadsheet";
import { createJobErrorResponse, mapErrorToCode } from "@/lib/errors/job-errors";
// TODO: Re-enable when GoogleSheetsSyncService is available in portal app
// import { createGoogleSheetsSyncService } from "@/lib/sync/GoogleSheetsSyncService";

/**
 * POST /api/background/process-spreadsheet
 * Process a spreadsheet file asynchronously using Vercel Background Functions
 */
export async function POST(request: NextRequest) {  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Start background processing    waitUntil(
      processSpreadsheet(jobId, user.id, supabase)
    );
    return NextResponse.json({
      success: true,
      jobId,
      message: "Processing started in background",
    });
  } catch (error: any) {
    console.error("Background processing error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function processSpreadsheet(jobId: string, userId: string, supabase: any) {  try {    
    // Use admin client for updates to bypass RLS if needed
    let adminClient;
    try {
      adminClient = createAdminClient();    } catch (adminError) {
      // Fallback to regular client if admin client fails
      adminClient = supabase;    }

    // Update job status to processing    const statusUpdateResult = await adminClient
      .from("categorization_jobs")
      .update({ 
        status: "processing",
        status_message: "Processing spreadsheet...",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    // Get job details to find file path
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("file_url")
      .eq("id", jobId)
      .single();
    if (jobError || !job) {
      const errorResponse = createJobErrorResponse("UNKNOWN_ERROR", "Job not found");      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_code: errorResponse.error_code,
          error_message: errorResponse.error_message,
          status_message: errorResponse.status_message,
        })
        .eq("id", jobId);
      return;
    }

    // Download file from Supabase Storage
    // Extract storage path from public URL
    // Public URL format: https://<project>.supabase.co/storage/v1/object/public/categorization-uploads/<userId>/<timestamp>-<filename>
    // We need: <userId>/<timestamp>-<filename>
    let filePath: string;
    if (job.file_url) {
      const urlParts = job.file_url.split('/object/public/categorization-uploads/');
      if (urlParts.length === 2) {
        // Extract path from public URL (everything after the bucket name)
        // Decode URL-encoded characters (spaces as %20, special chars, etc.)
        filePath = decodeURIComponent(urlParts[1].split('?')[0]);
      } else {
        // Fallback: try to extract from URL or use stored path
        // If file_url is already a path (not a full URL), use it directly
        if (job.file_url.includes('http')) {
          // Try to extract from URL path
          const pathMatch = job.file_url.match(/categorization-uploads\/(.+)/);
          const rawPath = pathMatch ? pathMatch[1].split('?')[0] : job.file_url.split('/').slice(-2).join('/');
          // Decode URL-encoded characters
          filePath = decodeURIComponent(rawPath);
        } else {
          // Already a path - decode in case it contains URL-encoded chars
          filePath = decodeURIComponent(job.file_url);
        }
      }
    } else {
      // Fallback: construct path from filename (less reliable)
      const fileName = job.original_filename || '';
      filePath = `${userId}/${Date.now()}-${fileName}`;    }    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("categorization-uploads")
      .download(filePath);
    if (downloadError || !fileData) {
      const errorCode = mapErrorToCode(downloadError || new Error("Failed to download file"));
      const errorResponse = createJobErrorResponse(errorCode, downloadError?.message || "Failed to download file");      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_code: errorResponse.error_code,
          error_message: errorResponse.error_message,
          status_message: errorResponse.status_message,
        })
        .eq("id", jobId);
      return;
    }

    // Process spreadsheet    const arrayBuffer = await fileData.arrayBuffer();
    // Pass admin client to bypass RLS for transaction inserts
    const result = await processSpreadsheetFile(arrayBuffer, jobId, userId, supabase, adminClient);
    if (!result.success) {
      const errorCode = mapErrorToCode(new Error(result.error || "Processing failed"));
      const errorResponse = createJobErrorResponse(errorCode, result.error || "Processing failed");      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_code: errorResponse.error_code,
          error_message: errorResponse.error_message,
          status_message: errorResponse.status_message,
        })
        .eq("id", jobId);
      return;
    }

    // Update job status to reviewing
    const finalStatusMessage = result.skippedCount && result.skippedCount > 0
      ? `Processing complete. ${result.insertedCount || 0} new transactions added, ${result.skippedCount} duplicates skipped.`
      : "Processing complete. Ready for review.";    
    const finalStatusUpdate = await adminClient
      .from("categorization_jobs")
      .update({ 
        status: "reviewing",
        status_message: finalStatusMessage,
        processed_items: result.insertedCount || result.transactionCount || 0,
        total_items: result.transactionCount || 0,
        failed_items: result.skippedCount || 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    // Check for auto-sync enabled sheets and sync if configured
    try {
      const { data: autoSyncSheets } = await supabase
        .from("sync_metadata")
        .select("source_id, source_name")
        .eq("user_id", userId)
        .eq("source_type", "google_sheets")
        .eq("auto_sync_enabled", true)
        .eq("sync_status", "active");

      if (autoSyncSheets && autoSyncSheets.length > 0) {
        console.log(`Auto-syncing to ${autoSyncSheets.length} Google Sheet(s)...`);
        
        // TODO: Re-enable when GoogleSheetsSyncService is available in portal app
        // const syncService = createGoogleSheetsSyncService(supabase);
        console.log(`Auto-sync temporarily disabled: GoogleSheetsSyncService not available (${autoSyncSheets.length} sheet(s) would be synced)`);
        // Skip sync for now
        return;
        
        /* Commented out until GoogleSheetsSyncService is available
        for (const sheet of autoSyncSheets) {
          try {
            const syncResult = await syncService.pushToSheets(sheet.source_id, userId, {
              jobId,
              mode: "append",
            });
            
            console.log(`Auto-sync to ${sheet.source_name || sheet.source_id}: ${syncResult.rowsPushed} rows pushed`);
            
            // Update sync metadata
            await supabase
              .from("sync_metadata")
              .update({
                last_sync_at: new Date().toISOString(),
                last_sync_direction: "push",
              })
              .eq("source_id", sheet.source_id)
              .eq("user_id", userId);
          } catch (syncError: any) {
            console.error(`Failed to auto-sync to ${sheet.source_name || sheet.source_id}:`, syncError);
            // Don't fail the job if auto-sync fails
          }
        }

        // Update job status to show it was synced
        await adminClient
          .from("categorization_jobs")
          .update({
            status_message: result.skippedCount && result.skippedCount > 0
              ? `Processing complete. ${result.insertedCount || 0} new transactions added, ${result.skippedCount} duplicates skipped. Auto-synced to Google Sheets.`
              : "Processing complete. Auto-synced to Google Sheets.",
          })
          .eq("id", jobId);
        */
      }
    } catch (autoSyncError) {
      console.error("Auto-sync check failed:", autoSyncError);
      // Don't fail the job if auto-sync fails
    }
  } catch (error: any) {    console.error("Process spreadsheet error:", error);
    
    // Try to update job status to failed
    try {
      let adminClient;
      try {
        adminClient = createAdminClient();
      } catch {
        adminClient = supabase;
      }
      
      const errorCode = mapErrorToCode(error);
      const errorResponse = createJobErrorResponse(errorCode, error.message || "Internal processing error");      
      const failedStatusUpdate = await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_code: errorResponse.error_code,
          error_message: errorResponse.error_message,
          status_message: errorResponse.status_message,
        })
        .eq("id", jobId);    } catch (updateError) {      console.error("Failed to update job status:", updateError);
    }
  }
}

