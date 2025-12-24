import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * POST /api/categorization/archive
 * Archive old financial documents to cold storage (GCS)
 * 
 * Body:
 *  - days_old: Archive documents older than X days (default: 90)
 *  - document_ids: Specific document IDs to archive (optional)
 *  - dry_run: If true, return what would be archived without actually doing it
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

    const body = await request.json();
    const daysOld = body.days_old || 90;
    const documentIds = body.document_ids || [];
    const dryRun = body.dry_run || false;

    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Build query for documents to archive
    let query = supabase
      .from("financial_documents")
      .select("id, original_filename, supabase_path, file_size_bytes, created_at")
      .eq("user_id", user.id)
      .eq("storage_tier", "hot"); // Only archive documents currently in hot storage

    if (documentIds.length > 0) {
      // Archive specific documents
      query = query.in("id", documentIds);
    } else {
      // Archive old documents
      query = query.lt("created_at", cutoffDate.toISOString());
    }

    const { data: documents, error: queryError } = await query;

    if (queryError) {
      console.error("Error querying documents:", queryError);
      return NextResponse.json(
        { error: "Failed to query documents" },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No documents to archive",
        archived_count: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        documents_to_archive: documents.length,
        total_size_bytes: documents.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0),
        documents: documents.map(d => ({
          id: d.id,
          filename: d.original_filename,
          size_bytes: d.file_size_bytes,
          created_at: d.created_at,
        })),
      });
    }

    // In a real implementation, you would:
    // 1. Copy files from Supabase Storage to GCS Archive bucket
    // 2. Update the financial_documents table with new storage info
    // 3. Optionally delete from Supabase Storage after successful copy
    
    // For now, we'll just mark them as archived in the database
    // and provide the path where they should be moved

    const archivedDocs = [];
    for (const doc of documents) {
      const gcsArchivePath = `archive/${user.id}/${doc.id}/${doc.original_filename}`;
      
      // Update document record to show it's archived
      const { error: updateError } = await supabase
        .from("financial_documents")
        .update({
          storage_tier: "archive",
          gcs_archive_path: gcsArchivePath,
          archived_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updateError) {
        console.error(`Failed to archive document ${doc.id}:`, updateError);
        continue;
      }

      archivedDocs.push({
        id: doc.id,
        filename: doc.original_filename,
        supabase_path: doc.supabase_path,
        gcs_archive_path: gcsArchivePath,
      });

      // TODO: In production, implement actual file transfer:
      // 1. Download file from Supabase Storage
      // 2. Upload to GCS with Archive storage class
      // 3. Delete from Supabase Storage after verification
      // Example:
      // const { data: fileData } = await supabase.storage
      //   .from('categorization-uploads')
      //   .download(doc.supabase_path);
      // 
      // await uploadToGCSArchive(fileData, gcsArchivePath);
      // 
      // await supabase.storage
      //   .from('categorization-uploads')
      //   .remove([doc.supabase_path]);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully archived ${archivedDocs.length} documents`,
      archived_count: archivedDocs.length,
      total_size_bytes: documents.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0),
      archived_documents: archivedDocs,
      note: "Files marked as archived. Implement GCS transfer in production.",
    });

  } catch (error: any) {
    console.error("Error in archive endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/categorization/archive
 * Get archiving statistics and eligible documents
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const daysOld = parseInt(searchParams.get("days_old") || "90");

    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get statistics
    const { data: hotDocs, error: hotError } = await supabase
      .from("financial_documents")
      .select("file_size_bytes")
      .eq("user_id", user.id)
      .eq("storage_tier", "hot");

    const { data: archivedDocs, error: archiveError } = await supabase
      .from("financial_documents")
      .select("file_size_bytes")
      .eq("user_id", user.id)
      .eq("storage_tier", "archive");

    const { data: eligibleDocs, error: eligibleError } = await supabase
      .from("financial_documents")
      .select("file_size_bytes")
      .eq("user_id", user.id)
      .eq("storage_tier", "hot")
      .lt("created_at", cutoffDate.toISOString());

    if (hotError || archiveError || eligibleError) {
      console.error("Error fetching statistics:", { hotError, archiveError, eligibleError });
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    const hotSize = hotDocs?.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) || 0;
    const archivedSize = archivedDocs?.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) || 0;
    const eligibleSize = eligibleDocs?.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      statistics: {
        hot_storage: {
          document_count: hotDocs?.length || 0,
          total_size_bytes: hotSize,
          total_size_mb: (hotSize / (1024 * 1024)).toFixed(2),
        },
        archive_storage: {
          document_count: archivedDocs?.length || 0,
          total_size_bytes: archivedSize,
          total_size_mb: (archivedSize / (1024 * 1024)).toFixed(2),
        },
        eligible_for_archive: {
          document_count: eligibleDocs?.length || 0,
          total_size_bytes: eligibleSize,
          total_size_mb: (eligibleSize / (1024 * 1024)).toFixed(2),
          days_old: daysOld,
        },
      },
    });

  } catch (error: any) {
    console.error("Error in archive statistics endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

