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
    
    // First, get transactions
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

    // Get matched documents separately to avoid foreign key relationship issues
    const matchedDocumentIds = transactions
      .map((tx: any) => tx.matched_document_id)
      .filter((id: string | null) => id !== null) as string[];

    let matchedDocumentsMap: Record<string, any> = {};
    if (matchedDocumentIds.length > 0) {
      const { data: documents } = await adminClient
        .from("financial_documents")
        .select("id, vendor_name, original_filename, document_date")
        .in("id", matchedDocumentIds);

      if (documents) {
        matchedDocumentsMap = documents.reduce((acc: Record<string, any>, doc: any) => {
          acc[doc.id] = doc;
          return acc;
        }, {});
      }
    }

    // Check if Google service account credentials are configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      console.error("Google Sheets export: Missing service account credentials");
      return NextResponse.json(
        { error: "Google Sheets export is not configured. Please configure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variables." },
        { status: 500 }
      );
    }

    // Initialize Google Sheets API
    let auth;
    try {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } catch (authError: any) {
      console.error("Google Sheets export: Auth initialization error:", authError);
      return NextResponse.json(
        { error: `Failed to initialize Google Auth: ${authError.message}` },
        { status: 500 }
      );
    }

    const sheets = google.sheets({ version: "v4", auth });

    // Create a new spreadsheet
    let spreadsheet;
    try {
      spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `Financial Transactions - ${job.original_filename || "Export"} - ${new Date().toLocaleDateString()}`,
          },
        },
      });
    } catch (createError: any) {
      console.error("Google Sheets export: Failed to create spreadsheet:", createError);
      return NextResponse.json(
        { error: `Failed to create spreadsheet: ${createError.message}` },
        { status: 500 }
      );
    }

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Failed to create spreadsheet: No spreadsheet ID returned" },
        { status: 500 }
      );
    }

    // Prepare data with reconciliation status
    const values = [
      [
        "Date",
        "Description",
        "Amount",
        "Category",
        "Subcategory",
        "Confidence",
        "Confirmed",
        "Reconciliation Status",
        "Matched Document",
        "Source Type",
        "Notes",
      ],
      ...transactions.map((tx: any) => {
        const matchedDoc = tx.matched_document_id ? matchedDocumentsMap[tx.matched_document_id] : null;
        const reconciliationStatus = tx.reconciliation_status || "unreconciled";
        const matchedDocInfo = matchedDoc
          ? `${matchedDoc.vendor_name || matchedDoc.original_filename || "Document"} (${matchedDoc.document_date || "N/A"})`
          : "";

        // Safely handle date parsing
        let dateStr = "";
        try {
          dateStr = tx.date ? new Date(tx.date).toLocaleDateString() : "";
        } catch {
          dateStr = tx.date || "";
        }

        // Safely handle confidence score
        const confidenceScore = tx.confidence_score != null 
          ? (typeof tx.confidence_score === 'number' ? tx.confidence_score : parseFloat(tx.confidence_score) || 0)
          : 0;

        return [
          dateStr,
          tx.original_description || "",
          tx.amount != null ? tx.amount.toString() : "0",
          tx.category || "Uncategorized",
          tx.subcategory || "",
          (confidenceScore * 100).toFixed(0) + "%",
          tx.user_confirmed ? "Yes" : "No",
          reconciliationStatus.charAt(0).toUpperCase() + reconciliationStatus.slice(1),
          matchedDocInfo,
          tx.source_type || "upload",
          tx.user_notes || "",
        ];
      }),
    ];

    // Write data to sheet
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });
    } catch (updateError: any) {
      console.error("Google Sheets export: Failed to update values:", updateError);
      return NextResponse.json(
        { error: `Failed to write data to spreadsheet: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Format header row
    try {
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
                  endIndex: 11, // Updated for new columns
                },
              },
            },
          ],
        },
      });
    } catch (formatError: any) {
      console.error("Google Sheets export: Failed to format sheet (non-critical):", formatError);
      // Don't fail the export if formatting fails - data was already written
    }

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
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    return NextResponse.json(
      { 
        error: error.message || "Failed to export to Google Sheets",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
