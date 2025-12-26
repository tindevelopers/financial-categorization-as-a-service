import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { google } from "googleapis";

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
    const { data: job, error: jobError } = await supabase
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

    // Get transactions using admin client to bypass RLS
    // Security is enforced by the job ownership check above
    const adminClient = createAdminClient();
    const { data: transactions, error: transactionsError } = await adminClient
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

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Create a new spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Financial Transactions - ${job.original_filename || "Export"} - ${new Date().toLocaleDateString()}`,
        },
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Failed to create spreadsheet" },
        { status: 500 }
      );
    }

    // Prepare data
    const values = [
      ["Date", "Description", "Amount", "Category", "Subcategory", "Confidence", "Confirmed", "Notes"],
      ...transactions.map((tx) => [
        new Date(tx.date).toLocaleDateString(),
        tx.original_description,
        tx.amount.toString(),
        tx.category || "Uncategorized",
        tx.subcategory || "",
        (tx.confidence_score * 100).toFixed(0) + "%",
        tx.user_confirmed ? "Yes" : "No",
        tx.user_notes || "",
      ]),
    ];

    // Write data to sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.2,
                    green: 0.4,
                    blue: 0.8,
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1,
                    },
                    bold: true,
                  },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: 8,
              },
            },
          },
        ],
      },
    });

    // Make spreadsheet shareable (optional - you might want to keep it private)
    // For now, we'll return the URL and let the user share it manually if needed

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    return NextResponse.json({
      success: true,
      sheetUrl,
      spreadsheetId,
      message: "Google Sheet created successfully",
    });
  } catch (error: any) {
    console.error("Google Sheets export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export to Google Sheets" },
      { status: 500 }
    );
  }
}
