import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

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

    // Get tenant_id for the user
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const formData = await request.formData();
    const fileCount = parseInt(formData.get("fileCount") as string || "0");

    if (fileCount === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Validate file count (max 50 for sync processing)
    if (fileCount > 50) {
      return NextResponse.json(
        { error: "Too many files. Maximum 50 invoices per upload. Please split into multiple batches." },
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
          return NextResponse.json(
            { error: `Invalid file type: ${file.name}. Please upload JPG, PNG, or PDF files only.` },
            { status: 400 }
          );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          return NextResponse.json(
            { error: `File too large: ${file.name}. Maximum size is 10MB.` },
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
        return NextResponse.json(
          { error: `Failed to upload file: ${file.name}` },
          { status: 500 }
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
        status: processingMode === "async" ? "queued" : "uploaded",
        processing_mode: processingMode,
        original_filename: files.map(f => f.name).join(", "),
        file_url: fileUrls[0], // Store first file URL (we'll store all in documents table)
        total_items: fileCount,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Job creation error:", jobError);
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
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
      message: `${fileCount} invoice${fileCount > 1 ? "s" : ""} uploaded successfully`,
      processingMode,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
