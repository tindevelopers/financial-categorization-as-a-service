import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { 
  exportVATReturn, 
  exportVATReturnCSV,
  exportSelfAssessment,
  exportSelfAssessmentCSV,
  exportCorporationTax,
  exportCorporationTaxCSV
} from "@/lib/exports/hmrc-export";

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
      type, // 'vat', 'self_assessment', 'corporation_tax'
      companyProfileId,
      periodStart,
      periodEnd,
      taxYear,
      format = 'csv'
    } = body;

    if (!companyProfileId) {
      return NextResponse.json(
        { error: "Company profile ID is required" },
        { status: 400 }
      );
    }

    // Get company profile
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("id", companyProfileId)
      .single();

    if (!companyProfile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    // Get transactions for the period
    const startDate = periodStart || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = periodEnd || new Date().toISOString().split('T')[0];

    const { data: transactions } = await supabase
      .from("categorized_transactions")
      .select(`
        date,
        amount,
        category,
        is_debit,
        job_id,
        categorization_jobs!inner(user_id)
      `)
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("categorization_jobs.user_id", user.id)
      .order("date", { ascending: false });

    if (type === 'vat') {
      if (!companyProfile.vat_registered || !companyProfile.vat_number) {
        return NextResponse.json(
          { error: "Company is not VAT registered" },
          { status: 400 }
        );
      }

      const vatReturn = await exportVATReturn(
        transactions?.map(tx => ({
          date: tx.date,
          amount: tx.amount,
          category: tx.category,
          is_debit: tx.is_debit,
        })) || [],
        companyProfile.vat_number,
        new Date(startDate),
        new Date(endDate),
        companyProfile.vat_scheme as 'standard' | 'flat_rate' | 'cash_accounting' || 'standard',
        companyProfile.flat_rate_percentage || undefined
      );

      if (format === 'csv') {
        const csv = exportVATReturnCSV(vatReturn);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="hmrc-vat-return-${Date.now()}.csv"`,
          },
        });
      }

      return NextResponse.json(vatReturn);
    }

    if (type === 'self_assessment') {
      const taxYearValue = taxYear || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`;
      
      const saData = await exportSelfAssessment(
        transactions?.map(tx => ({
          date: tx.date,
          amount: tx.amount,
          category: tx.category,
          is_debit: tx.is_debit,
        })) || [],
        taxYearValue
      );

      if (format === 'csv') {
        const csv = exportSelfAssessmentCSV(saData);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="hmrc-self-assessment-${Date.now()}.csv"`,
          },
        });
      }

      return NextResponse.json(saData);
    }

    if (type === 'corporation_tax') {
      if (!companyProfile.company_number) {
        return NextResponse.json(
          { error: "Company number is required for corporation tax" },
          { status: 400 }
        );
      }

      const ctData = await exportCorporationTax(
        transactions?.map(tx => ({
          date: tx.date,
          amount: tx.amount,
          category: tx.category,
          is_debit: tx.is_debit,
        })) || [],
        companyProfile.company_number,
        new Date(startDate),
        new Date(endDate)
      );

      if (format === 'csv') {
        const csv = exportCorporationTaxCSV(ctData);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="hmrc-corporation-tax-${Date.now()}.csv"`,
          },
        });
      }

      return NextResponse.json(ctData);
    }

    return NextResponse.json(
      { error: "Invalid export type. Must be 'vat', 'self_assessment', or 'corporation_tax'" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("HMRC export error:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}

