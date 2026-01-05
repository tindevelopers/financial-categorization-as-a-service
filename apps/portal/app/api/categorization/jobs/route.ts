import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * OPTIONS /api/categorization/jobs
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET /api/categorization/jobs
 * List all categorization jobs for the current user with optional filters
 * Query params:
 *  - status: filter by status (uploaded, processing, completed, failed)
 *  - job_type: filter by type (spreadsheet, invoice, batch_invoice)
 *  - limit: number of results (default: 50, max: 100)
 *  - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'uploads-list',hypothesisId:'H9',location:'apps/portal/app/api/categorization/jobs/route.ts:GET',message:'jobs endpoint unauthorized',data:{hasUser:!!user,hasAuthError:!!authError,authErrorCode:(authError as any)?.code||null,authErrorMsg:authError?.message||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "Unauthorized" },
        { 
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'uploads-list',hypothesisId:'H9',location:'apps/portal/app/api/categorization/jobs/route.ts:GET',message:'jobs endpoint entry',data:{userIdSuffix:(user.id&&user.id.length>=6)?user.id.slice(-6):null,limit:request.nextUrl.searchParams.get('limit')||null,offset:request.nextUrl.searchParams.get('offset')||null,status:request.nextUrl.searchParams.get('status')||null,jobType:request.nextUrl.searchParams.get('job_type')||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const jobType = searchParams.get("job_type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query with all columns including bank account info
    let query = supabase
      .from("categorization_jobs")
      .select(`
        id,
        job_type,
        status,
        processing_mode,
        original_filename,
        file_url,
        cloud_storage_provider,
        total_items,
        processed_items,
        failed_items,
        error_message,
        created_at,
        updated_at,
        started_at,
        completed_at,
        bank_account_id,
        spreadsheet_id,
        spreadsheet_tab_id,
        bank_account:bank_accounts(id, account_name, bank_name, account_type)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (jobType) {
      query = query.eq("job_type", jobType);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'uploads-list',hypothesisId:'H10',location:'apps/portal/app/api/categorization/jobs/route.ts:GET',message:'jobs query failed',data:{code:(jobsError as any)?.code||null,message:jobsError.message||null,details:(jobsError as any)?.details||null,hint:(jobsError as any)?.hint||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "Failed to fetch jobs", details: jobsError.message },
        { 
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Get financial documents for these jobs to include storage info
    const jobIds = jobs?.map(j => j.id) || [];
    let documents = null;
    if (jobIds.length > 0) {      const { data: docs } = await supabase
        .from("financial_documents")
        .select("job_id, storage_tier, archived_at, file_size_bytes, file_type")
        .in("job_id", jobIds);      documents = docs;
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'uploads-list',hypothesisId:'H11',location:'apps/portal/app/api/categorization/jobs/route.ts:GET',message:'jobs endpoint returning',data:{jobsCount:jobs?.length||0,jobIdsCount:jobIds.length,docsCount:documents?.length||0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Create a map of job_id -> document info
    const docMap = new Map();
    documents?.forEach(doc => {
      if (doc?.job_id) {
        if (!docMap.has(doc.job_id)) {
          docMap.set(doc.job_id, []);
        }
        docMap.get(doc.job_id).push(doc);
      }
    });

    // Enhance jobs with storage info
    const enhancedJobs = jobs?.map(job => {
      const jobDocs = docMap.get(job.id) || [];
      const storageTiers = jobDocs.map((d: any) => d.storage_tier);
      const totalSize = jobDocs.reduce((sum: number, d: any) => sum + (d.file_size_bytes || 0), 0);
      // Get file_type from first document (most jobs have one document)
      const fileType = jobDocs.length > 0 ? jobDocs[0].file_type : null;      
      return {
        ...job,
        file_type: fileType, // Include file_type from financial_documents
        storage_info: {
          tier: storageTiers.includes("archive") ? "archive" : 
                storageTiers.includes("restoring") ? "restoring" : "hot",
          total_size_bytes: totalSize,
          document_count: jobDocs.length,
          archived_at: jobDocs.find((d: any) => d.archived_at)?.archived_at || null,
        }
      };
    });

    // Get total count for pagination
    const { count } = await supabase
      .from("categorization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      jobs: enhancedJobs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      }
    }, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("Error in jobs endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}
