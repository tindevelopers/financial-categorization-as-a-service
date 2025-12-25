import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { findInvoiceMatches } from "@/lib/ai/invoice-matcher";

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
    const { invoice_id, bank_account_id } = body;

    if (!invoice_id) {
      return NextResponse.json(
        { error: "invoice_id is required" },
        { status: 400 }
      );
    }

    // Get invoice/document details
    const { data: invoice, error: invoiceError } = await supabase
      .from("financial_documents")
      .select("id, total_amount, document_date, vendor_name, bank_account_id, user_id")
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      // Try documents table as fallback
      const { data: docInvoice } = await supabase
        .from("documents")
        .select("id, total_amount, invoice_date, vendor_name, user_id")
        .eq("id", invoice_id)
        .eq("user_id", user.id)
        .single();

      if (!docInvoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      // Use document as invoice
      const invoiceData = {
        id: docInvoice.id,
        total_amount: docInvoice.total_amount,
        document_date: docInvoice.invoice_date,
        vendor_name: docInvoice.vendor_name,
        bank_account_id: bank_account_id || null,
      };

      // Get transactions
      let txQuery = supabase
        .from("categorized_transactions")
        .select(`
          id,
          date,
          amount,
          original_description,
          bank_account_id,
          bank_account:bank_accounts(account_name)
        `)
        .eq("reconciliation_status", "unreconciled")
        .order("date", { ascending: false })
        .limit(1000);

      // Filter by bank account if provided
      const finalBankAccountId = bank_account_id || invoiceData.bank_account_id;
      if (finalBankAccountId) {
        txQuery = txQuery.eq("bank_account_id", finalBankAccountId);
      }

      // Also filter by user via job
      const { data: transactions, error: txError } = await txQuery;

      if (txError) {
        console.error("Error fetching transactions:", txError);
        return NextResponse.json(
          { error: "Failed to fetch transactions" },
          { status: 500 }
        );
      }

      // Find matches
      const matches = await findInvoiceMatches(
        invoiceData,
        (transactions || []).map((tx: any) => ({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          original_description: tx.original_description,
          bank_account_id: tx.bank_account_id,
        })),
        5
      );

      // Enrich with bank account names
      const enrichedMatches = matches.map((match) => {
        const tx = transactions?.find((t: any) => t.id === match.transaction_id);
        const bankAccount = Array.isArray(tx?.bank_account) ? tx?.bank_account[0] : tx?.bank_account;
        return {
          ...match,
          bank_account_name: bankAccount?.account_name || null,
        };
      });

      return NextResponse.json({
        success: true,
        invoice_id: invoiceData.id,
        matches: enrichedMatches,
      });
    }

    // Use financial_documents invoice
    const invoiceData = {
      id: invoice.id,
      total_amount: invoice.total_amount,
      document_date: invoice.document_date,
      vendor_name: invoice.vendor_name,
      bank_account_id: bank_account_id || invoice.bank_account_id || null,
    };

    // Get transactions
    let txQuery = supabase
      .from("categorized_transactions")
      .select(`
        id,
        date,
        amount,
        original_description,
        bank_account_id,
        bank_account:bank_accounts(account_name),
        job:categorization_jobs!inner(user_id)
      `)
      .eq("job.user_id", user.id)
      .eq("reconciliation_status", "unreconciled")
      .order("date", { ascending: false })
      .limit(1000);

    // Filter by bank account if provided
    const finalBankAccountId = bank_account_id || invoiceData.bank_account_id;
    if (finalBankAccountId) {
      txQuery = txQuery.eq("bank_account_id", finalBankAccountId);
    }

    const { data: transactions, error: txError } = await txQuery;

    if (txError) {
      console.error("Error fetching transactions:", txError);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Find matches
    const matches = await findInvoiceMatches(
      invoiceData,
      (transactions || []).map((tx: any) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        original_description: tx.original_description,
        bank_account_id: tx.bank_account_id,
      })),
      5
    );

    // Enrich with bank account names
    const enrichedMatches = matches.map((match) => {
      const tx = transactions?.find((t: any) => t.id === match.transaction_id);
      const bankAccount = Array.isArray(tx?.bank_account) ? tx?.bank_account[0] : tx?.bank_account;
      return {
        ...match,
        bank_account_name: bankAccount?.account_name || null,
      };
    });

    return NextResponse.json({
      success: true,
      invoice_id: invoiceData.id,
      matches: enrichedMatches,
    });
  } catch (error: any) {
    console.error("Invoice-to-transaction matching error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

