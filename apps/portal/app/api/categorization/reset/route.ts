import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { deleteFromSupabase } from "@/lib/storage/supabase-storage";
import { deleteFromGCS } from "@/lib/storage/gcs-archive";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userData?.tenant_id || null;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found for user" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch documents to delete storage objects
    const { data: documents } = await adminClient
      .from("financial_documents")
      .select("id, supabase_path, storage_tier, gcs_archive_path")
      .eq("tenant_id", tenantId);

    // Delete storage objects
    if (documents) {
      for (const doc of documents) {
        if (doc.storage_tier === "hot" && doc.supabase_path) {
          await deleteFromSupabase(adminClient, doc.supabase_path);
        }
        if (doc.storage_tier === "archive" && doc.gcs_archive_path) {
          await deleteFromGCS(doc.gcs_archive_path);
        }
      }
    }

    // Delete categorized_transactions by tenant (via job)
    const { data: tenantJobs } = await adminClient
      .from("categorization_jobs")
      .select("id")
      .eq("tenant_id", tenantId);

    const jobIds = (tenantJobs || []).map((j: any) => j.id);
    if (jobIds.length > 0) {
      await adminClient
        .from("categorized_transactions")
        .delete()
        .in("job_id", jobIds);
    }

    // Delete financial_documents
    await adminClient
      .from("financial_documents")
      .delete()
      .eq("tenant_id", tenantId);

    // Delete categorization_jobs
    await adminClient
      .from("categorization_jobs")
      .delete()
      .eq("tenant_id", tenantId);

    return NextResponse.json({
      success: true,
      message: "Tenant data reset successfully",
    });
  } catch (error: any) {
    console.error("Tenant reset error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

