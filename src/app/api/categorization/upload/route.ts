import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

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
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload .xlsx, .xls, or .csv" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from("categorization-uploads")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("categorization-uploads")
      .getPublicUrl(fileName);

    // Create categorization job
    const { data: jobData, error: jobError } = await supabase
      .from("categorization_jobs")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        job_type: "spreadsheet",
        status: "uploaded",
        processing_mode: "sync",
        original_filename: file.name,
        file_url: urlData.publicUrl,
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

    // Trigger processing asynchronously (don't wait for completion)
    try {
      fetch(`${request.nextUrl.origin}/api/categorization/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ jobId: jobData.id }),
      }).catch(err => {
        console.error("Failed to trigger processing:", err);
        // Don't fail the upload
      });
    } catch (processError) {
      console.error("Failed to trigger processing:", processError);
      // Don't fail the upload
    }

    return NextResponse.json({
      success: true,
      jobId: jobData.id,
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

