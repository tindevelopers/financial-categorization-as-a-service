import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createJobErrorResponse, mapErrorToCode, getJobError } from "@/lib/errors/job-errors";

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
    const fileCount = parseInt(formData.get("fileCount") as string || "0");
    const bankAccountId = formData.get("bank_account_id") as string | null;

    // Enforce profile/company name
    // Check if ANY profile has a company_name (matches frontend logic)
    console.log('[DEBUG] Profile check start', { userId: user.id });
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from("company_profiles")
      .select("id, company_name")
      .eq("user_id", user.id);
    
    const hasName = allProfiles?.some(p => p.company_name && p.company_name.trim() !== '');
    console.log('[DEBUG] All profiles query result', { profileCount: allProfiles?.length, allProfiles, allProfilesError, hasName });

    console.log('[DEBUG] Profile completeness check', { hasName, willFail: !hasName });
    if (!hasName) {
      console.log('[DEBUG] PROFILE_INCOMPLETE error returned', { allProfiles, hasName });
      return NextResponse.json(
        { error: "PROFILE_INCOMPLETE", error_code: "PROFILE_INCOMPLETE" },
        { status: 400 }
      );
    }

    // Handle bank account - use suspense account if none provided
    let effectiveBankAccountId = bankAccountId;
    let bankAccount: { id: string; default_spreadsheet_id: string | null; spreadsheet_tab_name: string | null; is_active: boolean } | null = null;

    if (bankAccountId) {
      // Validate the provided bank account
      const { data: selectedAccount, error: bankAccountError } = await supabase
        .from("bank_accounts")
        .select("id, default_spreadsheet_id, spreadsheet_tab_name, is_active")
        .eq("id", bankAccountId)
        .eq("user_id", user.id)
        .single();

      if (bankAccountError || !selectedAccount || !selectedAccount.is_active) {
        return NextResponse.json(
          { error: "Invalid or inactive bank account", error_code: "BANK_ACCOUNT_INVALID" },
          { status: 400 }
        );
      }

      // Only require spreadsheet if a specific account was selected
      if (!selectedAccount.default_spreadsheet_id) {
        return NextResponse.json(
          { error: "SPREADSHEET_REQUIRED", error_code: "SPREADSHEET_REQUIRED" },
          { status: 400 }
        );
      }

      bankAccount = selectedAccount;
    } else {
      // No bank account provided - get or create suspense account
      const { data: suspenseAccountId, error: suspenseError } = await supabase
        .rpc('get_or_create_suspense_account', { p_user_id: user.id });

      if (suspenseError) {
        console.error("Failed to create suspense account:", suspenseError);
        return NextResponse.json(
          { error: "Failed to create default account for unmatched receipts", error_code: "SUSPENSE_ACCOUNT_ERROR" },
          { status: 500 }
        );
      }

      effectiveBankAccountId = suspenseAccountId;
      
      // Get the suspense account details
      const { data: suspenseAccount } = await supabase
        .from("bank_accounts")
        .select("id, default_spreadsheet_id, spreadsheet_tab_name, is_active")
        .eq("id", suspenseAccountId)
        .single();
      
      bankAccount = suspenseAccount;
    }

    if (fileCount === 0) {
      const errorResponse = createJobErrorResponse("INVALID_FILE_TYPE", "No files provided");
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: 400 }
      );
    }

    // Validate file count (max 50 for sync processing)
    if (fileCount > 50) {
      const errorResponse = createJobErrorResponse("INVALID_FILE_TYPE", "Too many files. Maximum 50 invoices per upload.");
      return NextResponse.json(
        { 
          error: errorResponse.error_message,
          error_code: errorResponse.error_code,
          status_message: errorResponse.status_message,
        },
        { status: 400 }
      );
    }

    const files: File[] = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`) as File;
      if (file) {
        // Validate file type
        const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)) {
          const errorResponse = createJobErrorResponse("INVALID_FILE_TYPE", `Invalid file type: ${file.name}`);
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
          const errorResponse = createJobErrorResponse("FILE_TOO_LARGE", `File too large: ${file.name}`);
          return NextResponse.json(
            { 
              error: errorResponse.error_message,
              error_code: errorResponse.error_code,
              status_message: errorResponse.status_message,
            },
            { status: 400 }
          );
        }

        files.push(file);
      }
    }

    // Upload files to Supabase Storage
    const uploadedFiles: string[] = [];
    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${user.id}/invoices/${Date.now()}-${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("categorization-uploads")
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        const errorCode = mapErrorToCode(uploadError);
        const errorResponse = createJobErrorResponse(errorCode, `Failed to upload file: ${file.name}`);
        return NextResponse.json(
          { 
            error: errorResponse.error_message,
            error_code: errorResponse.error_code,
            status_message: errorResponse.status_message,
          },
          { status: getJobError(errorCode).statusCode }
        );
      }

      uploadedFiles.push(fileName);
    }

    // Get public URLs
    const fileUrls = uploadedFiles.map(fileName => {
      const { data } = supabase.storage
        .from("categorization-uploads")
        .getPublicUrl(fileName);
      return data.publicUrl;
    });

    // Determine processing mode
    // Receipts: Always use async mode (especially if > 1 file)
    // Invoices: Use async if > 1 file, sync for single invoice
    // Since this endpoint is used for receipts/uploads, default to async for receipts
    // Check if files are receipts (receipts page uploads) vs invoices
    const isReceiptUpload = true; // This endpoint is used for receipt uploads
    const processingMode = isReceiptUpload 
      ? (fileCount > 1 ? "async" : "async") // Always async for receipts
      : (fileCount > 1 ? "async" : "sync"); // Async for multiple invoices, sync for single

    // Create categorization job
    const { data: jobData, error: jobError } = await supabase
      .from("categorization_jobs")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        job_type: fileCount === 1 ? "receipt" : "batch_receipt",
        status: "received", // File received, will be queued for processing
        status_message: `${fileCount} file${fileCount > 1 ? "s" : ""} uploaded successfully`,
        processing_mode: processingMode,
        original_filename: files.map(f => f.name).join(", "),
        file_url: fileUrls[0], // Store first file URL (we'll store all in documents table)
        total_items: fileCount,
        bank_account_id: effectiveBankAccountId, // Link job to bank account for processing
      })
      .select()
      .single();

    if (jobError) {
      console.error("Job creation error:", jobError);
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

    // Store document metadata for each receipt/invoice in financial_documents table
    // Determine file type: receipts are uploaded via this endpoint
    const fileType = "receipt"; // Receipts page uploads receipts
    const documentInserts = uploadedFiles.map((fileName, index) => ({
      user_id: user.id,
      tenant_id: userData?.tenant_id || null,
      job_id: jobData.id,
      original_filename: files[index].name,
      file_type: fileType,
      mime_type: files[index].type,
      file_size_bytes: files[index].size,
      storage_tier: "hot",
      supabase_path: fileName,
      ocr_status: "pending",
      bank_account_id: effectiveBankAccountId || null,
    }));

    const { error: docError } = await supabase
      .from("financial_documents")
      .insert(documentInserts);

    if (docError) {
      console.error("Failed to create financial_documents records:", docError);
      // Don't fail the upload, just log
    }

    // Store document metadata for each invoice in old documents table (legacy)
    for (let i = 0; i < files.length; i++) {
      await supabase.from("documents").insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        job_id: jobData.id,
        cloud_storage_provider: null, // Will be set after cloud sync
        cloud_storage_path: null,
        original_filename: files[i].name,
        file_type: "invoice",
        processing_status: "pending",
      });
    }

    // Trigger processing - receipts always use async mode
    // Update status to queued before triggering background processing
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: "queued",
        status_message: "Waiting to start processing...",
      })
      .eq("id", jobData.id);

    // Queue for async processing (Vercel Background Functions)
    try {
      fetch(`${request.nextUrl.origin}/api/background/process-invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ jobId: jobData.id }),
      }).catch(err => {
        console.error("Failed to queue background processing:", err);
      });
    } catch (processError) {
      console.error("Failed to queue background processing:", processError);
    }

    return NextResponse.json({
      success: true,
      jobId: jobData.id,
      status: "received",
      status_message: `${fileCount} file${fileCount > 1 ? "s" : ""} uploaded successfully`,
      message: `${fileCount} receipt${fileCount > 1 ? "s" : ""} uploaded successfully`,
      processingMode,
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
