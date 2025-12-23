import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:13',message:'GET /api/categorization/jobs entry',data:{url:request.url,searchParams:Object.fromEntries(request.nextUrl.searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:16',message:'Auth check result',data:{hasUser:!!user,userId:user?.id,hasAuthError:!!authError,authErrorCode:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (authError || !user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:19',message:'Auth failed returning 401',data:{authError:authError?.message,hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const jobType = searchParams.get("job_type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
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
        started_at,
        completed_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }); // Secondary sort for stable pagination

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (jobType) {
      query = query.eq("job_type", jobType);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:63',message:'Before query execution',data:{userId:user.id,limit,offset,status,jobType},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const { data: jobs, error: jobsError } = await query;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:65',message:'Query result',data:{hasJobs:!!jobs,jobsCount:jobs?.length,hasError:!!jobsError,errorCode:jobsError?.code,errorMessage:jobsError?.message,errorDetails:jobsError?.details,errorHint:jobsError?.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:67',message:'Query error returning 500',data:{errorCode:jobsError.code,errorMessage:jobsError.message,errorDetails:jobsError.details,errorHint:jobsError.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    // Get financial documents for these jobs to include storage info
    const jobIds = jobs?.map(j => j.id) || [];
    let documents = null;
    if (jobIds.length > 0) {
      const { data: docs } = await supabase
        .from("financial_documents")
        .select("job_id, storage_tier, archived_at, file_size_bytes")
        .in("job_id", jobIds);
      documents = docs;
    }

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
      const storageTiers = jobDocs.map(d => d.storage_tier);
      const totalSize = jobDocs.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0);
      
      return {
        ...job,
        storage_info: {
          tier: storageTiers.includes("archive") ? "archive" : 
                storageTiers.includes("restoring") ? "restoring" : "hot",
          total_size_bytes: totalSize,
          document_count: jobDocs.length,
          archived_at: jobDocs.find(d => d.archived_at)?.archived_at || null,
        }
      };
    });

    // Get total count for pagination
    // Use id column instead of * to avoid issues with missing updated_at column
    const { count, error: countError } = await supabase
      .from("categorization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:111',message:'Count query result',data:{count,hasCountError:!!countError,countErrorCode:countError?.code,countErrorMessage:countError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const response = {
      success: true,
      jobs: enhancedJobs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      }
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:125',message:'Returning success response',data:{jobsCount:response.jobs.length,totalCount:response.pagination.total},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error in jobs endpoint:", error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:127',message:'Exception caught',data:{errorMessage:error?.message,errorType:error?.constructor?.name,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

