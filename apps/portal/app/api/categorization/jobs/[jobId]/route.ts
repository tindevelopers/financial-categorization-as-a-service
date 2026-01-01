import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * OPTIONS /api/categorization/jobs/[jobId]
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    const { jobId } = await params;

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
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    }, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

/**
 * DELETE /api/categorization/jobs/[jobId]
 * Delete a single categorization job and all associated data (transactions, documents, storage file)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    const { jobId } = await params;

    // Verify job exists and belongs to the user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id, user_id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Fetch associated documents (to remove storage objects)
    const { data: documents, error: docsFetchError } = await supabase
      .from("financial_documents")
      .select("id, supabase_path, storage_tier, gcs_archive_path")
      .eq("job_id", jobId);

    if (docsFetchError) {
      console.error("Error fetching job documents:", docsFetchError);
    }

    const adminClient = createAdminClient();

    // Delete categorized transactions
    const { error: transactionsError } = await adminClient
      .from("categorized_transactions")
      .delete()
      .eq("job_id", jobId);

    if (transactionsError) {
      console.error("Error deleting categorized transactions:", transactionsError);
    }

    // Delete storage objects for hot-tier docs
    const hotPaths = (documents || [])
      .filter(d => d.storage_tier === "hot" && d.supabase_path)
      .map(d => d.supabase_path as string);

    if (hotPaths.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < hotPaths.length; i += batchSize) {
        const batch = hotPaths.slice(i, i + batchSize);
        const { error: storageError } = await supabase.storage
          .from("categorization-uploads")
          .remove(batch);

        if (storageError) {
          console.error("Error deleting files from storage:", storageError);
        }
      }
    }

    // Delete financial_documents rows
    if (documents && documents.length > 0) {
      const { error: docsDeleteError } = await adminClient
        .from("financial_documents")
        .delete()
        .eq("job_id", jobId);

      if (docsDeleteError) {
        console.error("Error deleting financial_documents:", docsDeleteError);
      }
    }

    // Delete the job row
    const { error: deleteJobError } = await adminClient
      .from("categorization_jobs")
      .delete()
      .eq("id", jobId);

    if (deleteJobError) {
      console.error("Error deleting job:", deleteJobError);
      return NextResponse.json(
        { error: "Failed to delete job" },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deleted: true,
        jobId,
        warnings: {
          archived_files_not_removed: (documents || []).some(d => d.storage_tier !== "hot"),
        },
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error: any) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}
