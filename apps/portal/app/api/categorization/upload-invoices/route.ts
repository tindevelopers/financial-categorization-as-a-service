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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-invoices/route.ts:33',message:'Profile check start',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const { data: profile, error: profileError } = await supabase
      .from("company_profiles")
      .select("id, company_name")
      .eq("user_id", user.id)
      .maybeSingle();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-invoices/route.ts:40',message:'Profile query result',data:{profile:profile,profileError:profileError,companyName:profile?.company_name,companyNameType:typeof profile?.company_name,companyNameLength:profile?.company_name?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    
    // Check profile count without maybeSingle to test hypothesis A
    // #region agent log
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from("company_profiles")
      .select("id, company_name")
      .eq("user_id", user.id);
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-invoices/route.ts:47',message:'All profiles query result',data:{profileCount:allProfiles?.length,allProfiles:allProfiles,allProfilesError:allProfilesError,hasName:allProfiles?.some(p=>p.company_name)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-invoices/route.ts:50',message:'Profile completeness check',data:{profileExists:!!profile,companyNameExists:!!profile?.company_name,companyNameTruthy:!!(profile?.company_name),willFail:!profile || !profile.company_name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    if (!profile || !profile.company_name) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-invoices/route.ts:53',message:'PROFILE_INCOMPLETE error returned',data:{profile:profile,companyName:profile?.company_name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "PROFILE_INCOMPLETE", error_code: "PROFILE_INCOMPLETE" },
        { status: 400 }
      );
    }

    // Require bank account
    if (!bankAccountId) {
      return NextResponse.json(
        { error: "BANK_ACCOUNT_REQUIRED", error_code: "BANK_ACCOUNT_REQUIRED" },
        { status: 400 }
      );
    }

    // Validate bank account and spreadsheet requirement
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from("bank_accounts")
      .select("id, default_spreadsheet_id, spreadsheet_tab_name, is_active")
      .eq("id", bankAccountId)
      .eq("user_id", user.id)
      .single();

    if (bankAccountError || !bankAccount || !bankAccount.is_active) {
      return NextResponse.json(
        { error: "Invalid or inactive bank account", error_code: "BANK_ACCOUNT_INVALID" },
        { status: 400 }
      );
    }

    if (!bankAccount.default_spreadsheet_id) {
      return NextResponse.json(
        { error: "SPREADSHEET_REQUIRED", error_code: "SPREADSHEET_REQUIRED" },
        { status: 400 }
      );
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
    const processingMode = fileCount >= 50 ? "async" : "sync";

    // Create categorization job
    const { data: jobData, error: jobError } = await supabase
      .from("categorization_jobs")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        job_type: fileCount === 1 ? "invoice" : "batch_invoice",
        status: "received", // File received, will be queued for processing
        status_message: `${fileCount} file${fileCount > 1 ? "s" : ""} uploaded successfully`,
        processing_mode: processingMode,
        original_filename: files.map(f => f.name).join(", "),
        file_url: fileUrls[0], // Store first file URL (we'll store all in documents table)
        total_items: fileCount,
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

    // Store document metadata for each invoice in financial_documents table
    const documentInserts = uploadedFiles.map((fileName, index) => ({
      user_id: user.id,
      tenant_id: userData?.tenant_id || null,
      job_id: jobData.id,
      original_filename: files[index].name,
      file_type: "invoice",
      mime_type: files[index].type,
      file_size_bytes: files[index].size,
      storage_tier: "hot",
      supabase_path: fileName,
      ocr_status: "pending",
      bank_account_id: bankAccountId || null,
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

    // Trigger processing
    if (processingMode === "sync") {
      // Update status to processing for sync mode
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "processing",
          status_message: "Processing files...",
          started_at: new Date().toISOString(),
        })
        .eq("id", jobData.id);

      // Process synchronously (for small batches)
      try {
        fetch(`${request.nextUrl.origin}/api/categorization/process-invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({ jobId: jobData.id }),
        }).catch(err => {
          console.error("Failed to trigger processing:", err);
        });
      } catch (processError) {
        console.error("Failed to trigger processing:", processError);
      }
    } else {
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
    }

    return NextResponse.json({
      success: true,
      jobId: jobData.id,
      status: "received",
      status_message: `${fileCount} file${fileCount > 1 ? "s" : ""} uploaded successfully`,
      message: `${fileCount} invoice${fileCount > 1 ? "s" : ""} uploaded successfully`,
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
