import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import {
  generateProfitAndLoss,
  generateBalanceSheet,
  generateCashFlowStatement,
  generateTrialBalance,
} from "@/lib/financial-statements/statement-generator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
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

    const { type } = await params;
    const body = await request.json();
    const { companyProfileId, startDate, endDate, asOfDate, format = 'json' } = body;

    if (!companyProfileId) {
      return NextResponse.json(
        { error: "Company profile ID is required" },
        { status: 400 }
      );
    }

    let result: any;

    switch (type) {
      case 'profit-and-loss':
      case 'pl':
      case 'income-statement':
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: "Start date and end date are required for P&L statement" },
            { status: 400 }
          );
        }
        result = await generateProfitAndLoss(
          supabase,
          new Date(startDate),
          new Date(endDate),
          companyProfileId
        );
        break;

      case 'balance-sheet':
      case 'bs':
        if (!asOfDate) {
          return NextResponse.json(
            { error: "As of date is required for balance sheet" },
            { status: 400 }
          );
        }
        result = await generateBalanceSheet(
          supabase,
          new Date(asOfDate),
          companyProfileId
        );
        break;

      case 'cash-flow':
      case 'cf':
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: "Start date and end date are required for cash flow statement" },
            { status: 400 }
          );
        }
        result = await generateCashFlowStatement(
          supabase,
          new Date(startDate),
          new Date(endDate),
          companyProfileId
        );
        break;

      case 'trial-balance':
      case 'tb':
        if (!asOfDate) {
          return NextResponse.json(
            { error: "As of date is required for trial balance" },
            { status: 400 }
          );
        }
        result = await generateTrialBalance(
          supabase,
          new Date(asOfDate),
          companyProfileId
        );
        break;

      default:
        return NextResponse.json(
          { error: `Invalid statement type: ${type}` },
          { status: 400 }
        );
    }

    if (format === 'csv') {
      // Convert to CSV (simplified - would need proper CSV formatting)
      const csv = convertToCSV(result);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Financial statement export error:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}

function convertToCSV(data: any): string {
  // Simple CSV conversion - would need proper implementation for nested structures
  if (typeof data === 'object' && !Array.isArray(data)) {
    const rows: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        rows.push(`${key},`);
        rows.push(convertToCSV(value));
      } else {
        rows.push(`${key},${value}`);
      }
    }
    return rows.join('\n');
  }
  return JSON.stringify(data);
}

