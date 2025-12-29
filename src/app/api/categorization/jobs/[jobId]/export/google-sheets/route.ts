import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

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

    // Get credentials from credential manager
    // For corporate Google Sheets export, use tenant-specific service account if available
    const credentialManager = getCredentialManager();
    
    // Get tenant_id for tenant-specific credentials
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    
    // Try tenant-specific service account first (corporate), then fall back to platform default
    const serviceAccountCreds = await credentialManager.getBestGoogleServiceAccount(
      (userData as { tenant_id?: string | null })?.tenant_id || undefined
    );

    if (!serviceAccountCreds) {
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
    return NextResponse.json(
      { 
        error: "Google Sheets export requires additional configuration. Use CSV export instead.",
        csvAvailable: true,
      },
      { status: 501 }
    );
  } catch (error: unknown) {    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export" },
      { status: 500 }
    );
  }
}
