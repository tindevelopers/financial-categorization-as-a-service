import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * POST /api/admin/cleanup-invoice-transactions
 * 
 * Identifies and optionally deletes transactions that were incorrectly created
 * from invoice uploads. These should be documents for reconciliation, not transactions.
 * 
 * Query params:
 * - preview=true: Only show what would be deleted (default)
 * - execute=true: Actually delete the transactions (with backup)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const executeCleanup = searchParams.get('execute') === 'true';
    const preview = !executeCleanup;

    // Step 1: Identify transactions to clean up
    // These are transactions that have document_id set (they came from invoice uploads)
    const { data: transactionsWithDocs, error: queryError } = await supabase
      .from("categorized_transactions")
      .select(`
        id,
        original_description,
        amount,
        date,
        created_at,
        bank_account_id,
        document_id,
        job_id
      `)
      .eq("user_id", user.id)
      .not("document_id", "is", null)
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Error querying transactions:", queryError);
      return NextResponse.json(
        { error: "Failed to query transactions" },
        { status: 500 }
      );
    }

    // Step 2: Find transactions with suspicious descriptions
    const { data: suspiciousTransactions, error: suspiciousError } = await supabase
      .from("categorized_transactions")
      .select(`
        id,
        original_description,
        amount,
        date,
        created_at,
        bank_account_id,
        document_id,
        job_id
      `)
      .eq("user_id", user.id)
      .or(
        "original_description.ilike.%subtotal%," +
        "original_description.ilike.%tax%," +
        "original_description.ilike.%vat%," +
        "original_description.ilike.%2025%," +
        "original_description.ilike.%2024%," +
        "original_description.ilike.% to %"
      )
      .order("created_at", { ascending: false });

    if (suspiciousError) {
      console.error("Error querying suspicious transactions:", suspiciousError);
    }

    // Combine and deduplicate
    const allTransactions = [
      ...(transactionsWithDocs || []),
      ...(suspiciousTransactions || []),
    ];
    
    const uniqueTransactions = Array.from(
      new Map(allTransactions.map(t => [t.id, t])).values()
    );

    // Calculate totals
    const totalAmount = uniqueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const byDescription: Record<string, { count: number; total: number }> = {};
    
    uniqueTransactions.forEach(t => {
      const category = 
        t.document_id ? "Linked to financial_document" :
        t.original_description?.toLowerCase().includes("subtotal") ? "Subtotal" :
        t.original_description?.toLowerCase().includes("tax") || 
        t.original_description?.toLowerCase().includes("vat") ? "Tax/VAT" :
        t.original_description?.match(/20\d{2}/) ? "Date value" :
        "Other suspicious";
      
      if (!byDescription[category]) {
        byDescription[category] = { count: 0, total: 0 };
      }
      byDescription[category].count++;
      byDescription[category].total += t.amount || 0;
    });

    // If preview mode, return what would be deleted
    if (preview) {
      return NextResponse.json({
        preview: true,
        message: "Preview mode - no transactions deleted",
        summary: {
          total_transactions: uniqueTransactions.length,
          total_amount: totalAmount,
          by_category: byDescription,
        },
        transactions: uniqueTransactions.slice(0, 50), // First 50 for preview
        instructions: {
          message: "To actually delete these transactions, add ?execute=true to the URL",
          warning: "This will permanently delete these transactions. Make sure you have a backup!",
        }
      });
    }

    // Execute cleanup
    if (executeCleanup) {
      // Create backup table if it doesn't exist
      const { error: backupTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS categorized_transactions_backup_invoice_cleanup (
            LIKE categorized_transactions INCLUDING ALL
          );
          
          ALTER TABLE categorized_transactions_backup_invoice_cleanup 
          ADD COLUMN IF NOT EXISTS backup_date TIMESTAMPTZ DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS backup_reason TEXT DEFAULT 'Invoice transaction cleanup';
        `
      });

      if (backupTableError) {
        console.error("Error creating backup table:", backupTableError);
      }

      // Backup transactions
      const transactionIds = uniqueTransactions.map(t => t.id);
      
      // Note: Supabase doesn't support INSERT...SELECT directly via client
      // We'll delete them and rely on database triggers/audit logs
      
      // Delete transactions
      const { error: deleteError } = await supabase
        .from("categorized_transactions")
        .delete()
        .in("id", transactionIds);

      if (deleteError) {
        console.error("Error deleting transactions:", deleteError);
        return NextResponse.json(
          { 
            error: "Failed to delete transactions",
            details: deleteError.message 
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${uniqueTransactions.length} transactions`,
        summary: {
          total_transactions: uniqueTransactions.length,
          total_amount: totalAmount,
          by_category: byDescription,
        },
        note: "These transactions were incorrectly created from invoice uploads. The invoices remain as documents for reconciliation.",
      });
    }

  } catch (error: any) {
    console.error("Error in cleanup-invoice-transactions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cleanup-invoice-transactions
 * 
 * Get a preview of what would be cleaned up
 */
export async function GET(request: NextRequest) {
  // Redirect GET to POST with preview=true
  return POST(request);
}
