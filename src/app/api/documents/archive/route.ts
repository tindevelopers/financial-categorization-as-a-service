import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/core/database/admin-client";
import {
  archiveToGCS,
  generateArchivePath,
  isGCSConfigured,
} from "@/lib/storage/gcs-archive";
import { deleteFromSupabase } from "@/lib/storage/supabase-storage";

/**
 * Document Archive Lifecycle Job
 * Moves documents older than 30 days from Supabase Storage to GCS Archive
 * This endpoint should be called by a cron job (daily)
 */

export const maxDuration = 300; // 5 minutes for batch processing

interface ArchiveResult {
  documentId: string;
  success: boolean;
  error?: string;
  archivePath?: string;
}

/**
 * POST: Archive documents older than 30 days
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify request is from cron job
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized. This endpoint requires CRON_SECRET." },
        { status: 401 }
      );
    }

    if (!isGCSConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Google Cloud Storage is not configured. Skipping archival.",
        skipped: true,
      });
    }

    const body = await request.json().catch(() => ({}));
    const daysOld = body.daysOld || 30;
    const batchSize = Math.min(body.batchSize || 20, 100);
    const dryRun = body.dryRun === true;

    const supabase = createAdminClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Define document type
    type EligibleDocument = {
      id: string;
      tenant_id: string;
      entity_id: string | null;
      original_filename: string | null;
      document_date: string | null;
      supabase_path: string;
      created_at: string;
    };

    // Find documents eligible for archival
    const { data: eligibleDocs, error: fetchError } = await supabase
      .from("financial_documents")
      .select(
        "id, tenant_id, entity_id, original_filename, document_date, supabase_path, created_at"
      )
      .eq("storage_tier", "hot")
      .eq("is_deleted", false)
      .lt("created_at", cutoffDate.toISOString())
      .not("supabase_path", "is", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error("Failed to fetch eligible documents:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    if (!eligibleDocs) {
      return NextResponse.json({
        success: true,
        message: "No documents eligible for archival",
        archived: 0,
      });
    }

    if (eligibleDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No documents eligible for archival",
        archived: 0,
      });
    }

    // Type assertion for documents
    const docs: EligibleDocument[] = eligibleDocs as EligibleDocument[];

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        eligibleCount: docs.length,
        documents: docs.map((d) => ({
          id: d.id,
          filename: d.original_filename,
          createdAt: d.created_at,
        })),
      });
    }

    const results: ArchiveResult[] = [];

    for (const doc of docs) {
      // Mark as pending archive
      await (supabase
        .from("financial_documents") as any)
        .update({ storage_tier: "pending_archive" })
        .eq("id", doc.id);

      // Generate archive path
      const documentDate = doc.document_date
        ? new Date(doc.document_date)
        : new Date(doc.created_at);

      const archivePath = generateArchivePath(
        doc.tenant_id,
        doc.entity_id,
        doc.id,
        doc.original_filename || "document",
        documentDate
      );

      // Archive to GCS
      const archiveResult = await archiveToGCS(
        supabase,
        doc.supabase_path,
        archivePath
      );

      if (!archiveResult.success) {
        // Revert to hot storage on failure
        await (supabase
          .from("financial_documents") as any)
          .update({ storage_tier: "hot" })
          .eq("id", doc.id);

        results.push({
          documentId: doc.id,
          success: false,
          error: archiveResult.error,
        });
        continue;
      }

      // Delete from Supabase Storage
      const deleteResult = await deleteFromSupabase(supabase, doc.supabase_path);

      if (!deleteResult.success) {
        console.warn(
          `Failed to delete from Supabase after archive: ${deleteResult.error}`
        );
        // Continue anyway - file is archived, we can clean up Supabase later
      }

      // Update document record
      await (supabase
        .from("financial_documents") as any)
        .update({
          storage_tier: "archive",
          gcs_archive_path: archivePath,
          archived_at: new Date().toISOString(),
          supabase_path: null, // Clear since we deleted it
        })
        .eq("id", doc.id);

      results.push({
        documentId: doc.id,
        success: true,
        archivePath,
      });
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      archived: successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("Archive job error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Archive job failed" },
      { status: 500 }
    );
  }
}

/**
 * GET: Get archival status and stats
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createAdminClient();

    // Get counts by storage tier
    const tiers = ["hot", "pending_archive", "archive"];
    const counts: Record<string, number> = {};
    const sizes: Record<string, number> = {};

    for (const tier of tiers) {
      const result = await (supabase
        .from("financial_documents") as any)
        .select("file_size_bytes", { count: "exact" })
        .eq("storage_tier", tier)
        .eq("is_deleted", false);

      counts[tier] = result.count || 0;
      type SizeData = { file_size_bytes: number | null };
      sizes[tier] = ((result.data as SizeData[]) || [])?.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) || 0;
    }

    // Get documents eligible for archival (created > 30 days ago, still in hot storage)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const { count: eligibleCount } = await (supabase
      .from("financial_documents") as any)
      .select("*", { count: "exact", head: true })
      .eq("storage_tier", "hot")
      .eq("is_deleted", false)
      .lt("created_at", cutoffDate.toISOString());

    return NextResponse.json({
      storageTiers: counts,
      storageSizes: {
        hot: formatBytes(sizes.hot),
        pending_archive: formatBytes(sizes.pending_archive),
        archive: formatBytes(sizes.archive),
        total: formatBytes(Object.values(sizes).reduce((a, b) => a + b, 0)),
      },
      eligibleForArchival: eligibleCount || 0,
      gcsConfigured: isGCSConfigured(),
    });
  } catch (error) {
    console.error("Archive status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

