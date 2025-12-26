import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { google } from "googleapis";
import crypto from "crypto";

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

    // Check for Google authentication credentials
    // Option A: Corporate/Company level - Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
    // Option B: Individual level - OAuth (requires user to connect their Google account)
    const hasServiceAccount = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    );
    const hasOAuthCredentials = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Helper function to decrypt OAuth tokens
    const decryptToken = (encryptedText: string): string => {
      if (!encryptedText) return "";
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error("ENCRYPTION_KEY not configured");
      }
      const parts = encryptedText.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid encrypted text format");
      }
      const [ivHex, ciphertext] = parts;
      const algorithm = "aes-256-cbc";
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(
        algorithm,
        Buffer.from(encryptionKey, "hex"),
        iv
      );
      let decrypted = decipher.update(ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    };

    // Try to get user's OAuth tokens (Option B)
    let userOAuthTokens: { accessToken: string; refreshToken: string | null; expiresAt: Date | null } | null = null;
    if (!hasServiceAccount && hasOAuthCredentials) {
      // Check for user's Google Sheets OAuth connection
      const { data: integration } = await supabase
        .from("user_integrations")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", user.id)
        .eq("provider", "google_sheets")
        .single();

      const { data: connection } = await supabase
        .from("cloud_storage_connections")
        .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
        .eq("user_id", user.id)
        .eq("provider", "google_sheets")
        .eq("is_active", true)
        .single();

      if (integration?.access_token || connection?.access_token_encrypted) {
        try {
          const accessToken = integration?.access_token 
            ? decryptToken(integration.access_token)
            : connection?.access_token_encrypted 
              ? decryptToken(connection.access_token_encrypted)
              : null;
          
          const refreshToken = integration?.refresh_token
            ? decryptToken(integration.refresh_token)
            : connection?.refresh_token_encrypted
              ? decryptToken(connection.refresh_token_encrypted)
              : null;

          const expiresAt = integration?.expires_at 
            ? new Date(integration.expires_at)
            : connection?.token_expires_at
              ? new Date(connection.token_expires_at)
              : null;

          if (accessToken) {
            userOAuthTokens = { accessToken, refreshToken, expiresAt };
            console.log("Google Sheets export: Found user OAuth connection (Option B)");
          }
        } catch (decryptError: any) {
          console.warn("Google Sheets export: Failed to decrypt OAuth tokens:", decryptError.message);
        }
      }
    }

    // If neither service account nor OAuth tokens are available, fallback to CSV
    if (!hasServiceAccount && !userOAuthTokens) {
      console.warn("Google Sheets export: No authentication method available", {
        hasServiceAccount,
        hasOAuthCredentials,
        hasUserOAuthTokens: !!userOAuthTokens,
      });
      
      // Fallback to CSV export
      
      // Generate CSV as fallback
      const csvHeaders = [
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
      ];
      
      const csvRows = [
        csvHeaders.join(","),
        ...transactions.map((tx: any) => {
          const matchedDoc = tx.matched_document_id ? matchedDocumentsMap[tx.matched_document_id] : null;
          const reconciliationStatus = tx.reconciliation_status || "unreconciled";
          const matchedDocInfo = matchedDoc
            ? `${matchedDoc.vendor_name || matchedDoc.original_filename || "Document"} (${matchedDoc.document_date || "N/A"})`
            : "";

          let dateStr = "";
          try {
            dateStr = tx.date ? new Date(tx.date).toLocaleDateString() : "";
          } catch {
            dateStr = tx.date || "";
          }

          const confidenceScore = tx.confidence_score != null 
            ? (typeof tx.confidence_score === 'number' ? tx.confidence_score : parseFloat(tx.confidence_score) || 0)
            : 0;

          const row = [
            `"${dateStr}"`,
            `"${(tx.original_description || "").replace(/"/g, '""')}"`,
            tx.amount != null ? tx.amount.toString() : "0",
            `"${(tx.category || "Uncategorized").replace(/"/g, '""')}"`,
            `"${(tx.subcategory || "").replace(/"/g, '""')}"`,
            (confidenceScore * 100).toFixed(0) + "%",
            tx.user_confirmed ? "Yes" : "No",
            `"${reconciliationStatus.charAt(0).toUpperCase() + reconciliationStatus.slice(1)}"`,
            `"${matchedDocInfo.replace(/"/g, '""')}"`,
            `"${(tx.source_type || "upload").replace(/"/g, '""')}"`,
            `"${(tx.user_notes || "").replace(/"/g, '""')}"`,
          ];
          return row.join(",");
        }),
      ];
      
      const csvContent = csvRows.join("\n");
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="transactions-${jobId}.csv"`,
        },
      });
    }

    // Initialize Google Sheets API
    // Priority: Service Account (Option A) > User OAuth (Option B)
    let auth;
    let authMethod: "service_account" | "oauth" = "service_account";
    
    try {
      if (hasServiceAccount) {
        // Option A: Use service account (corporate/company-level)
        console.log("Google Sheets export: Using service account (Option A)");
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          },
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        authMethod = "service_account";
      } else if (userOAuthTokens) {
        // Option B: Use user OAuth tokens (individual-level)
        console.log("Google Sheets export: Using user OAuth (Option B)");
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_SHEETS_REDIRECT_URI || 
          process.env.GOOGLE_REDIRECT_URI || 
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google-sheets/callback`
        );

        // Check if token is expired and refresh if needed
        if (userOAuthTokens.expiresAt && userOAuthTokens.expiresAt < new Date()) {
          if (userOAuthTokens.refreshToken) {
            try {
              oauth2Client.setCredentials({
                refresh_token: userOAuthTokens.refreshToken,
              });
              const { credentials } = await oauth2Client.refreshAccessToken();
              userOAuthTokens.accessToken = credentials.access_token || userOAuthTokens.accessToken;
              console.log("Google Sheets export: Refreshed expired OAuth token");
            } catch (refreshError: any) {
              console.error("Google Sheets export: Token refresh failed:", refreshError);
              return NextResponse.json(
                { 
                  error: "Your Google account connection has expired. Please reconnect in Settings > Integrations.",
                  error_code: "TOKEN_EXPIRED",
                  requiresReconnect: true
                },
                { status: 401 }
              );
            }
          } else {
            return NextResponse.json(
              { 
                error: "Your Google account connection has expired. Please reconnect in Settings > Integrations.",
                error_code: "TOKEN_EXPIRED",
                requiresReconnect: true
              },
              { status: 401 }
            );
          }
        }

        oauth2Client.setCredentials({
          access_token: userOAuthTokens.accessToken,
          refresh_token: userOAuthTokens.refreshToken || undefined,
        });

        auth = oauth2Client;
        authMethod = "oauth";
      } else {
        // This should never happen due to check above, but TypeScript needs it
        return NextResponse.json(
          { error: "No Google authentication method available" },
          { status: 500 }
        );
      }
    } catch (authError: any) {
      console.error("Google Sheets export: Auth initialization error:", authError);
      return NextResponse.json(
        { error: `Failed to initialize Google Auth: ${authError.message}` },
        { status: 500 }
      );
    }

    const sheets = google.sheets({ version: "v4", auth });

    // Check if job already has a spreadsheet_id
    let spreadsheetId: string | null = null;
    let isNewSheet = false;
    let existingSheetData: any = null;
    let lastRowWithData = 0;

    if (job.spreadsheet_id) {
      // Try to access existing spreadsheet
      try {
        const spreadsheetMetadata = await sheets.spreadsheets.get({
          spreadsheetId: job.spreadsheet_id,
        });
        
        if (spreadsheetMetadata.data) {
          spreadsheetId = job.spreadsheet_id;
          console.log(`Google Sheets export: Using existing spreadsheet ${spreadsheetId}`);
          
          // Try to read existing data to check structure
          try {
            const existingData = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: "Sheet1",
            });
            
            existingSheetData = existingData.data.values || [];
            
            // Find last row with data
            if (existingSheetData.length > 0) {
              lastRowWithData = existingSheetData.length;
              console.log(`Google Sheets export: Found ${lastRowWithData} rows in existing sheet`);
            }
          } catch (readError: any) {
            console.warn("Google Sheets export: Could not read existing sheet data:", readError.message);
            // Continue with append - will append to end
            existingSheetData = [];
          }
        }
      } catch (accessError: any) {
        console.warn(`Google Sheets export: Cannot access existing spreadsheet ${job.spreadsheet_id}:`, accessError.message);
        // Spreadsheet doesn't exist or is inaccessible, will create new one
        spreadsheetId = null;
      }
    }

    // Create new spreadsheet if needed
    if (!spreadsheetId) {
      isNewSheet = true;
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

      spreadsheetId = spreadsheet.data.spreadsheetId;
      if (!spreadsheetId) {
        return NextResponse.json(
          { error: "Failed to create spreadsheet: No spreadsheet ID returned" },
          { status: 500 }
        );
      }
      
      console.log(`Google Sheets export: Created new spreadsheet ${spreadsheetId}`);
    }

    // Define expected headers
    const expectedHeaders = [
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
    ];

    // Check if existing sheet has matching headers
    let shouldWriteHeaders = isNewSheet;
    let startRow = 1; // 1-indexed for Google Sheets API
    
    if (!isNewSheet && existingSheetData.length > 0) {
      const existingHeaders = existingSheetData[0];
      // Check if headers match (case-insensitive comparison)
      const headersMatch = existingHeaders && 
        existingHeaders.length === expectedHeaders.length &&
        existingHeaders.every((h: string, i: number) => 
          h?.toString().toLowerCase().trim() === expectedHeaders[i]?.toLowerCase().trim()
        );
      
      if (headersMatch) {
        // Headers match, append data only
        shouldWriteHeaders = false;
        startRow = lastRowWithData + 1; // Append after last row
        console.log(`Google Sheets export: Headers match, appending to row ${startRow}`);
      } else {
        // Headers don't match - this is a problem
        console.warn("Google Sheets export: Existing sheet headers don't match expected format");
        return NextResponse.json(
          { 
            error: "Existing spreadsheet has different column structure. Please use a new spreadsheet or manually fix the headers.",
            details: {
              expected: expectedHeaders,
              found: existingHeaders
            }
          },
          { status: 400 }
        );
      }
    } else if (!isNewSheet && existingSheetData.length === 0) {
      // Sheet exists but is empty, write headers + data
      shouldWriteHeaders = true;
      startRow = 1;
      console.log("Google Sheets export: Sheet exists but is empty, writing headers + data");
    }

    // Prepare transaction data rows
    const transactionRows = transactions.map((tx: any) => {
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
    });

    // Prepare values to write
    const values = shouldWriteHeaders 
      ? [expectedHeaders, ...transactionRows]
      : transactionRows;

    // Ensure spreadsheetId is set (should never be null at this point, but TypeScript check)
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Internal error: Spreadsheet ID not set" },
        { status: 500 }
      );
    }

    // Determine range based on start row
    const range = `Sheet1!A${startRow}`;

    // Write data to sheet
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });
      console.log(`Google Sheets export: Successfully wrote ${values.length} rows starting at ${range}`);
    } catch (updateError: any) {
      console.error("Google Sheets export: Failed to update values:", updateError);
      return NextResponse.json(
        { error: `Failed to write data to spreadsheet: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Format header row (only if we wrote headers)
    if (shouldWriteHeaders) {
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
        console.log("Google Sheets export: Formatted header row");
      } catch (formatError: any) {
        console.error("Google Sheets export: Failed to format sheet (non-critical):", formatError);
        // Don't fail the export if formatting fails - data was already written
      }
    } else {
      // Still auto-resize columns even when appending
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId: 0,
                    dimension: "COLUMNS",
                    startIndex: 0,
                    endIndex: 11,
                  },
                },
              },
            ],
          },
        });
      } catch (formatError: any) {
        console.error("Google Sheets export: Failed to auto-resize columns (non-critical):", formatError);
      }
    }

    // Store spreadsheet_id in job record if this is a new sheet
    if (isNewSheet && spreadsheetId) {
      try {
        const { error: updateError } = await supabase
          .from("categorization_jobs")
          .update({ spreadsheet_id: spreadsheetId })
          .eq("id", jobId)
          .eq("user_id", user.id);

        if (updateError) {
          console.error("Google Sheets export: Failed to store spreadsheet_id:", updateError);
          // Don't fail the export - spreadsheet was created successfully
        } else {
          console.log(`Google Sheets export: Stored spreadsheet_id ${spreadsheetId} in job record`);
        }
      } catch (dbError: any) {
        console.error("Google Sheets export: Error storing spreadsheet_id:", dbError);
        // Don't fail the export - spreadsheet was created successfully
      }
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    console.log(`Google Sheets export: Export completed successfully using ${authMethod === "service_account" ? "service account (Option A - Corporate)" : "user OAuth (Option B - Individual)"}`);

    return NextResponse.json({
      success: true,
      sheetUrl,
      spreadsheetId,
      message: isNewSheet 
        ? "Google Sheet created successfully" 
        : `Successfully appended ${transactionRows.length} transaction(s) to existing Google Sheet`,
      isNewSheet,
      rowsAppended: transactionRows.length,
      authMethod, // Include which method was used for debugging
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
