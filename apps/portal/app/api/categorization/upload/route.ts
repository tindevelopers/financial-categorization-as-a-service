import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@tinadmin/core/database/admin-client";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { createJobErrorResponse, mapErrorToCode, getJobError } from "@/lib/errors/job-errors";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse = createJobErrorResponse("AUTHENTICATION_ERROR");
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: 401 }
      );
    }

    // Get tenant_id for the user
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      const errorResponse = createJobErrorResponse("INVALID_FILE_TYPE", "No file provided");
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: 400 }
      );
    }

    // Validate file type
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      const errorResponse = createJobErrorResponse("INVALID_FILE_TYPE");
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const errorResponse = createJobErrorResponse("FILE_TOO_LARGE");
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: 400 }
      );
    }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload/route.ts:64',message:'Upload request received',data:{fileName:file.name,fileSize:file.size,fileType:file.type,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

    // Convert file to buffer and calculate hash
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

    // Check for force upload flag
    const forceUpload = formData.get("force") === "true";

    // Check for duplicate files (hash-based only) unless force upload is requested
    if (!forceUpload) {
      const { data: existingDoc } = await supabase
        .from("financial_documents")
        .select("id, job_id")
        .eq("file_hash", fileHash)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingDoc) {
        // Duplicate detected - return 409 Conflict with existing job info
        const errorResponse = createJobErrorResponse("DUPLICATE_FILE");
        return NextResponse.json(
          {
            error: errorResponse.error_message,
            error_code: errorResponse.error_code,
            status_message: errorResponse.status_message,
            isDuplicate: true,
            existingJobId: existingDoc.job_id,
            existingDocumentId: existingDoc.id,
          },
          { status: 409 }
        );
      }
    }

    // Upload to Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload/route.ts:70',message:'File storage location',data:{fileName,storageBucket:'categorization-uploads',userId:user.id,fileSize:file.size},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("categorization-uploads")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload/route.ts:79',message:'Storage upload error',data:{error:uploadError.message,fileName},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error("Storage upload error:", uploadError);
      const errorCode = mapErrorToCode(uploadError);
      const errorResponse = createJobErrorResponse(errorCode, uploadError.message);
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: getJobError(errorCode).statusCode }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("categorization-uploads")
      .getPublicUrl(fileName);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload/route.ts:88',message:'File uploaded successfully',data:{fileName,publicUrl:urlData.publicUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Create categorization job
    // Use admin client to bypass RLS, but we've already validated the user above
    // This is necessary because server-side RLS context may not be properly set
    let jobData;
    let jobError;
    
    try {
      const adminClient = createAdminClient();
      const result = await adminClient
        .from("categorization_jobs")
        .insert({
          user_id: user.id,
          tenant_id: userData?.tenant_id || null,
          job_type: "spreadsheet",
          status: "received", // File received, will be queued for processing
          status_message: "File uploaded successfully",
          processing_mode: "async", // Always async processing
          original_filename: file.name,
          file_url: urlData.publicUrl,
          file_hash: fileHash, // Store hash for quick duplicate detection
        })
        .select()
        .single();
      
      jobData = result.data;
      jobError = result.error;
    } catch (adminError: any) {
      console.error("Admin client error:", adminError);
      // Fallback to regular client if admin client fails
      const result = await supabase
        .from("categorization_jobs")
        .insert({
          user_id: user.id,
          tenant_id: userData?.tenant_id || null,
          job_type: "spreadsheet",
          status: "received", // File received, will be queued for processing
          status_message: "File uploaded successfully",
          processing_mode: "async", // Always async processing
          original_filename: file.name,
          file_url: urlData.publicUrl,
          file_hash: fileHash, // Store hash for quick duplicate detection
        })
        .select()
        .single();
      
      jobData = result.data;
      jobError = result.error;
    }

    if (jobError) {
      console.error("Job creation error:", jobError);
      console.error("Job creation error details:", {
        message: jobError.message,
        code: jobError.code,
        details: jobError.details,
        hint: jobError.hint,
        user_id: user.id,
        tenant_id: userData?.tenant_id,
      });
      const errorCode = mapErrorToCode(jobError);
      const errorResponse = createJobErrorResponse(errorCode, jobError.message);
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: getJobError(errorCode).statusCode }
      );
    }

    // Also create a record in financial_documents for long-term storage tracking
    const { error: docError } = await supabase
      .from("financial_documents")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        job_id: jobData.id, // Link to categorization job for tracking
        original_filename: file.name,
        file_type: "bank_statement",
        mime_type: file.type,
        file_size_bytes: file.size,
        file_hash: fileHash, // Store hash for duplicate detection
        storage_tier: "hot", // Start in hot storage (Supabase)
        supabase_path: fileName,
        ocr_status: "pending",
      });

    if (docError) {
      console.error("Failed to create financial_documents record:", docError);
      // Don't fail the upload, just log the error
    }

    // Queue for async processing using Vercel Background Functions
    try {
      // Update status to queued before triggering background processing
      try {
        const adminClient = createAdminClient();
        await adminClient
          .from("categorization_jobs")
          .update({ 
            status: "queued",
            status_message: "Waiting to start processing...",
          })
          .eq("id", jobData.id);
      } catch (updateError) {
        // Fallback to regular client
        await supabase
          .from("categorization_jobs")
          .update({ 
            status: "queued",
            status_message: "Waiting to start processing...",
          })
          .eq("id", jobData.id);
      }

      // Trigger background processing (don't wait for completion)
      fetch(`${request.nextUrl.origin}/api/background/process-spreadsheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ jobId: jobData.id }),
      }).catch(err => {
        console.error("Failed to queue background processing:", err);
        // Don't fail the upload - cron job will pick it up if needed
      });
    } catch (processError) {
      console.error("Failed to queue background processing:", processError);
      // Don't fail the upload - cron job will pick it up if needed
    }

    return NextResponse.json({
      success: true,
      jobId: jobData.id,
      status: "received",
      status_message: "File uploaded successfully",
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    const errorCode = mapErrorToCode(error);
    const errorResponse = createJobErrorResponse(errorCode, error.message);
    return NextResponse.json(
      { 
        error: errorResponse.error_message,
        error_code: errorResponse.error_code,
        status_message: errorResponse.status_message,
      },
      { status: getJobError(errorCode).statusCode }
    );
  }
}
