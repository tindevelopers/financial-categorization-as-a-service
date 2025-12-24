import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { processSpreadsheetFile } from "@/lib/categorization/process-spreadsheet";

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

    // Get job details
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

    // Update job status to processing
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Download file from Supabase Storage
    const fileName = job.file_url?.split("/").pop() || "";
    const filePath = `${user.id}/${fileName.split("-").slice(1).join("-")}`;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("categorization-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "Failed to download file",
        })
        .eq("id", jobId);
      
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
    }

    // Process spreadsheet using shared utility
    const arrayBuffer = await fileData.arrayBuffer();
    const result = await processSpreadsheetFile(arrayBuffer, jobId, user.id, supabase);

    if (!result.success) {
      await supabase
        .from("categorization_jobs")
        .update({
          status: "failed",
          error_message: result.error || "Processing failed",
        })
        .eq("id", jobId);

      return NextResponse.json(
        { error: result.error || "Processing failed" },
        { status: 500 }
      );
    }

    // Update job status to reviewing
    await supabase
      .from("categorization_jobs")
      .update({
        status: "reviewing",
        processed_items: result.transactionCount || 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return NextResponse.json({
      success: true,
      jobId,
      transactionCount: result.transactionCount,
      message: "Spreadsheet processed successfully",
    });
  } catch (error: any) {
    console.error("Process error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

