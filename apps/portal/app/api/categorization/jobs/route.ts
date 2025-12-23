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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:13',message:'GET /api/categorization/jobs entry',data:{url:request.url,searchParams:Object.fromEntries(request.nextUrl.searchParams),method:request.method,headers:Object.fromEntries(request.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:18',message:'Creating Supabase client',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const supabase = await createClient();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:21',message:'Supabase client created - calling getUser',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:24',message:'Auth check result',data:{hasUser:!!user,userId:user?.id || null,hasAuthError:!!authError,authErrorCode:authError?.code || null,authErrorMessage:authError?.message || null},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    if (authError || !user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:28',message:'Auth failed returning 401',data:{authError:authError?.message || null,hasUser:!!user,userId:user?.id || null},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H3'})}).catch(()=>{});
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
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:78',message:'Query result',data:{hasJobs:!!jobs,jobsCount:jobs?.length || 0,hasError:!!jobsError,errorCode:jobsError?.code || null,errorMessage:jobsError?.message || null,errorDetails:jobsError?.details || null,errorHint:jobsError?.hint || null},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:83',message:'Query error returning 500',data:{errorCode:jobsError.code,errorMessage:jobsError.message,errorDetails:jobsError.details,errorHint:jobsError.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H4'})}).catch(()=>{});
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
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:155',message:'Returning success response',data:{jobsCount:response.jobs.length,totalCount:response.pagination.total,hasJobs:response.jobs.length > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("Error in jobs endpoint:", error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/categorization/jobs/route.ts:159',message:'Exception caught',data:{errorMessage:error?.message || 'unknown',errorType:error?.constructor?.name || 'unknown',errorStack:error?.stack?.substring(0,300) || 'no stack'},timestamp:Date.now(),sessionId:'debug-session',runId:'debug-run-1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
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

