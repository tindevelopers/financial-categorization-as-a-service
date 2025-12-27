import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { exportTransactionsToXero, exportChartOfAccountsToXero } from "@/lib/exports/xero-export";

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
    const { 
      jobId, 
      companyProfileId, 
      format = 'csv',
      includeContacts = false,
      includeTax = false 
    } = body;

    if (!companyProfileId) {
      return NextResponse.json(
        { error: "Company profile ID is required" },
        { status: 400 }
      );
    }

    // Get transactions
    let transactions: any[] = [];
    
    if (jobId) {
      // Export specific job
      const { data: jobTransactions } = await supabase
        .from("categorized_transactions")
        .select(`
          date,
          original_description,
          amount,
          category,
          subcategory,
          reference_number,
          transaction_type,
          is_debit,
          job_id,
          categorization_jobs!inner(user_id)
        `)
        .eq("job_id", jobId)
        .eq("categorization_jobs.user_id", user.id)
        .order("date", { ascending: false });

      transactions = jobTransactions || [];
    } else {
      // Export all transactions for company
      const { data: allTransactions } = await supabase
        .from("categorized_transactions")
        .select(`
          date,
          original_description,
          amount,
          category,
          subcategory,
          reference_number,
          transaction_type,
          is_debit,
          job_id,
          categorization_jobs!inner(user_id, tenant_id)
        `)
        .eq("categorization_jobs.user_id", user.id)
        .order("date", { ascending: false });

      transactions = allTransactions || [];
    }

    // Get category to account mappings
    const { data: accountMappings } = await supabase
      .from("category_account_mapping")
      .select(`
        category,
        subcategory,
        account_code,
        chart_of_accounts!inner(account_name)
      `)
      .eq("company_profile_id", companyProfileId);

    // Build mapping
    const mapping = new Map<string, { code: string; name: string }>();
    accountMappings?.forEach((m: any) => {
      const key = m.subcategory ? `${m.category}:${m.subcategory}` : m.category;
      mapping.set(key, {
        code: m.account_code,
        name: m.chart_of_accounts?.account_name || m.category,
      });
    });

    // Export transactions
    const exportData = await exportTransactionsToXero(
      transactions.map(tx => ({
        date: tx.date,
        description: tx.original_description,
        amount: tx.amount,
        category: tx.category,
        subcategory: tx.subcategory,
        reference_number: tx.reference_number,
        transaction_type: tx.transaction_type,
        is_debit: tx.is_debit,
      })),
      mapping,
      { format: format as 'csv' | 'json', includeContacts, includeTax }
    );

    // Set appropriate content type
    const contentType = format === 'json' 
      ? 'application/json' 
      : 'text/csv';

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="xero-export-${Date.now()}.${format === 'json' ? 'json' : 'csv'}"`,
      },
    });
  } catch (error: any) {
    console.error("XERO export error:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}

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

    const { searchParams } = new URL(request.url);
    const companyProfileId = searchParams.get("companyProfileId");
    const type = searchParams.get("type") || "transactions";

    if (!companyProfileId) {
      return NextResponse.json(
        { error: "Company profile ID is required" },
        { status: 400 }
      );
    }

    if (type === "accounts") {
      // Export chart of accounts
      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_profile_id", companyProfileId)
        .eq("is_active", true);

      const exportData = exportChartOfAccountsToXero(accounts || []);

      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="xero-accounts-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid export type" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("XERO export error:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}

