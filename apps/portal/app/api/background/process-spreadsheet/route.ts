import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@tinadmin/core/database/admin-client";
import { processSpreadsheetFile } from "@/lib/categorization/process-spreadsheet";

/**
 * POST /api/background/process-spreadsheet
 * Process a spreadsheet file asynchronously using Vercel Background Functions
 */
export async function POST(request: NextRequest) {
  try {
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

    // Start background processing
    waitUntil(
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

async function processSpreadsheet(jobId: string, userId: string, supabase: any) {
  try {
    // Use admin client for updates to bypass RLS if needed
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      // Fallback to regular client if admin client fails
      adminClient = supabase;
    }

    // Update job status to processing
    await adminClient
      .from("categorization_jobs")
      .update({ 
        status: "processing",
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
      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "Job not found",
        })
        .eq("id", jobId);
      return;
    }

    // Download file from Supabase Storage
    const fileName = job.file_url?.split("/").pop() || "";
    const filePath = `${userId}/${fileName.split("-").slice(1).join("-")}`;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("categorization-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "Failed to download file",
        })
        .eq("id", jobId);
      return;
    }

    // Process spreadsheet
    const arrayBuffer = await fileData.arrayBuffer();
    const result = await processSpreadsheetFile(arrayBuffer, jobId, userId, supabase);

    if (!result.success) {
      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: result.error || "Processing failed",
        })
        .eq("id", jobId);
      return;
    }

    // Update job status to reviewing
    await adminClient
      .from("categorization_jobs")
      .update({ 
        status: "reviewing",
        processed_items: result.transactionCount || 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (error: any) {
    console.error("Process spreadsheet error:", error);
    
    // Try to update job status to failed
    try {
      let adminClient;
      try {
        adminClient = createAdminClient();
      } catch {
        adminClient = supabase;
      }
      
      await adminClient
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: error.message || "Internal processing error",
        })
        .eq("id", jobId);
    } catch (updateError) {
      console.error("Failed to update job status:", updateError);
    }
  }
}

