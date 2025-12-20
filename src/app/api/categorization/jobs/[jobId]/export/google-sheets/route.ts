import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { jobId } = await params;

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H1",
        location: "src/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts:entry",
        message: "Export request received",
        data: { jobId, userId: user?.id ?? "unknown" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Verify job belongs to user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job, error: jobError } = await (supabase as any)
      .from("categorization_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Get transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: transactions, error: transactionsError } = await (supabase as any)
      .from("categorized_transactions")
      .select("*")
      .eq("job_id", jobId)
      .order("date", { ascending: false });

    if (transactionsError || !transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found" },
        { status: 400 }
      );
    }

    // Check if Google Sheets API is configured
    const googleServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!googleServiceEmail || !googlePrivateKey) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "H1",
          location: "src/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts:csvFallback",
          message: "Service account missing, returning CSV fallback",
          data: {
            hasEmail: Boolean(googleServiceEmail),
            hasKey: Boolean(googlePrivateKey),
            transactionCount: transactions.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // Return a CSV download instead
      const csvHeader = "Date,Description,Amount,Category,Subcategory,Confidence,Confirmed,Notes\n";
      const csvRows = transactions.map((tx: {
        date: string;
        original_description: string;
        amount: number;
        category: string | null;
        subcategory: string | null;
        confidence_score: number;
        user_confirmed: boolean;
        user_notes: string | null;
      }) => {
        const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
        return [
          escapeCsv(new Date(tx.date).toLocaleDateString()),
          escapeCsv(tx.original_description),
          tx.amount.toString(),
          escapeCsv(tx.category || "Uncategorized"),
          escapeCsv(tx.subcategory || ""),
          (tx.confidence_score * 100).toFixed(0) + "%",
          tx.user_confirmed ? "Yes" : "No",
          escapeCsv(tx.user_notes || ""),
        ].join(",");
      }).join("\n");

      const csvContent = csvHeader + csvRows;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="transactions-${jobId}.csv"`,
        },
      });
    }

    // Google Sheets integration would go here
    // For now, return an error indicating it's not fully configured
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H1",
        location: "src/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts:serviceAccountPresent",
        message: "Service account present, Google Sheets flow not implemented",
        data: {
          hasEmail: Boolean(googleServiceEmail),
          hasKey: Boolean(googlePrivateKey),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return NextResponse.json(
      { 
        error: "Google Sheets export requires additional configuration. Use CSV export instead.",
        csvAvailable: true,
      },
      { status: 501 }
    );
  } catch (error: unknown) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H2",
        location: "src/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts:catch",
        message: "Export route threw",
        data: { error: error instanceof Error ? error.message : "unknown" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export" },
      { status: 500 }
    );
  }
}
