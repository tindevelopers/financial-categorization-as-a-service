import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

interface Transaction {
  id: string;
  date: string;
  original_description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  confidence_score: number;
  user_confirmed: boolean;
  user_notes: string | null;
  created_at: string;
}

function escapeCsv(str: string): string {
  if (str === null || str === undefined) return '""';
  const escaped = String(str).replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function generateCSV(transactions: Transaction[]): string {
  const headers = [
    "Date",
    "Description",
    "Amount",
    "Category",
    "Subcategory",
    "Confidence",
    "Confirmed",
    "Notes",
  ];

  const headerRow = headers.join(",");
  
  const dataRows = transactions.map((tx) => {
    return [
      escapeCsv(formatDate(tx.date)),
      escapeCsv(tx.original_description),
      tx.amount.toFixed(2),
      escapeCsv(tx.category || "Uncategorized"),
      escapeCsv(tx.subcategory || ""),
      `${(tx.confidence_score * 100).toFixed(0)}%`,
      tx.user_confirmed ? "Yes" : "No",
      escapeCsv(tx.user_notes || ""),
    ].join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

function generateExcelXML(transactions: Transaction[], filename: string): string {
  // Generate Excel 2003 XML format (widely compatible)
  const escapeXml = (str: string) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const rows = transactions.map((tx) => {
    return `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(formatDate(tx.date))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(tx.original_description)}</Data></Cell>
        <Cell><Data ss:Type="Number">${tx.amount}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(tx.category || "Uncategorized")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(tx.subcategory || "")}</Data></Cell>
        <Cell><Data ss:Type="String">${(tx.confidence_score * 100).toFixed(0)}%</Data></Cell>
        <Cell><Data ss:Type="String">${tx.user_confirmed ? "Yes" : "No"}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(tx.user_notes || "")}</Data></Cell>
      </Row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E8F4FD" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="&quot;$&quot;#,##0.00"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(filename)}">
    <Table>
      <Column ss:Width="80"/>
      <Column ss:Width="250"/>
      <Column ss:Width="80"/>
      <Column ss:Width="120"/>
      <Column ss:Width="120"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="200"/>
      <Row ss:StyleID="Header">
        <Cell><Data ss:Type="String">Date</Data></Cell>
        <Cell><Data ss:Type="String">Description</Data></Cell>
        <Cell><Data ss:Type="String">Amount</Data></Cell>
        <Cell><Data ss:Type="String">Category</Data></Cell>
        <Cell><Data ss:Type="String">Subcategory</Data></Cell>
        <Cell><Data ss:Type="String">Confidence</Data></Cell>
        <Cell><Data ss:Type="String">Confirmed</Data></Cell>
        <Cell><Data ss:Type="String">Notes</Data></Cell>
      </Row>
      ${rows.join("")}
    </Table>
  </Worksheet>
</Workbook>`;
}

export async function GET(
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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    // Verify job belongs to user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job, error: jobError } = await (supabase as any)
      .from("categorization_jobs")
      .select("id, original_filename")
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
      .order("date", { ascending: true });

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found" },
        { status: 404 }
      );
    }

    const baseFilename = job.original_filename
      ? job.original_filename.replace(/\.[^/.]+$/, "")
      : `transactions-${jobId.slice(0, 8)}`;

    if (format === "excel" || format === "xlsx") {
      const excelContent = generateExcelXML(transactions, baseFilename);
      return new NextResponse(excelContent, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="${baseFilename}-export.xls"`,
        },
      });
    }

    // Default to CSV
    const csvContent = generateCSV(transactions);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseFilename}-export.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export" },
      { status: 500 }
    );
  }
}


