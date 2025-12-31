import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { google } from "googleapis";
import { getUserOAuthTokens, createOAuthSheetsClient } from "@/lib/google-sheets/auth-helpers";
import { detectUserAccountType, getRecommendedAuthMethod } from "@/lib/google-sheets/user-preference";
import { VercelCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { getWorkspaceAdminInfo, createWorkspaceAdminSheetsClient } from "@/lib/google-sheets/workspace-admin";
import { createTenantGoogleClientsForRequestUser } from "@/lib/google-sheets/tenant-clients";
import { getTenantGoogleIntegrationConfig } from "@/lib/google-sheets/tier-config";
import { 
  getOrCreateMasterSpreadsheet, 
  getExistingFingerprints, 
  addUploadTab, 
  appendFingerprints, 
  rebuildAllTransactionsTab,
  generateTabName,
  findExistingJobTab,
  syncUploadTab,
  TransactionRow,
} from "@/lib/google-sheets/master-spreadsheet";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const reqId = Math.random().toString(36).substring(7);  try {
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

    // Get bank account with linked spreadsheet (if job has bank_account_id)
    let linkedSpreadsheetId: string | null = null;
    let linkedSpreadsheetSource: "job" | "bank_account" | "company" | "new" = "new";
    let bankAccountName: string | null = null;
    let isSuspenseAccount = false;
    
    if (job.bank_account_id) {
      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("id, account_name, default_spreadsheet_id, spreadsheet_tab_name, account_type, is_default_suspense")
        .eq("id", job.bank_account_id)
        .single();
      
      if (bankAccount) {
        bankAccountName = bankAccount.account_name;
        isSuspenseAccount = bankAccount.account_type === 'suspense' || bankAccount.is_default_suspense === true;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/google-sheets/route.ts:69',message:'Bank account details',data:{accountName:bankAccountName,isSuspenseAccount,hasSpreadsheet:!!bankAccount.default_spreadsheet_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // For suspense accounts, we'll use company master spreadsheet if available
        // Otherwise use the bank account's spreadsheet if it has one
        if (bankAccount.default_spreadsheet_id && !isSuspenseAccount) {
          linkedSpreadsheetId = bankAccount.default_spreadsheet_id;
          linkedSpreadsheetSource = "bank_account";
        }
        // If suspense account has no spreadsheet, we'll fall back to company master spreadsheet later
      }
    }
    
    // If job already has a spreadsheet_id, use that (sync mode)
    if (job.spreadsheet_id) {
      linkedSpreadsheetId = job.spreadsheet_id;
      linkedSpreadsheetSource = "job";
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

    // Get tenant ID for tenant-specific credentials
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    
    const tenantId = userData?.tenant_id || null;

    // Check for company shared drive configuration
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("id, google_shared_drive_id, google_shared_drive_name, google_master_spreadsheet_id, google_master_spreadsheet_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // For suspense accounts without a spreadsheet, use company master spreadsheet if available
    if (isSuspenseAccount && !linkedSpreadsheetId && companyProfile?.google_master_spreadsheet_id) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/google-sheets/route.ts:142',message:'Using company master spreadsheet for suspense account',data:{spreadsheetId:companyProfile.google_master_spreadsheet_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      linkedSpreadsheetId = companyProfile.google_master_spreadsheet_id;
      linkedSpreadsheetSource = "company";
    }
    
    // Check for Google authentication credentials using credential manager
    // Priority: Workspace Admin > Service Account > User OAuth
    const credentialManager = VercelCredentialManager.getInstance();
    
    // Check for Workspace Admin account first
    const workspaceAdminInfo = await getWorkspaceAdminInfo(user.id);
    const isWorkspaceAdmin = workspaceAdminInfo?.isWorkspaceAdmin || false;
    
    // Option A: Corporate/Company level - Service Account
    const serviceAccountCreds = await credentialManager.getBestGoogleServiceAccount(tenantId || undefined);
    const hasServiceAccount = !!serviceAccountCreds;    
    // Option B: Individual level - OAuth (tenant-specific or platform-level)
    const tenantOAuthCreds = tenantId 
      ? await credentialManager.getBestGoogleOAuth(tenantId)
      : null;
    const platformOAuthCreds = await credentialManager.getGoogleOAuth();
    const hasOAuthCredentials = !!(tenantOAuthCreds || platformOAuthCreds);

    // Try to get user's OAuth tokens (Option B) using helper module
    // ALWAYS try to get user OAuth tokens - they take priority over service account
    // because service accounts may lack permissions to create spreadsheets
    let userOAuthTokens = null;
    if (hasOAuthCredentials) {
      try {
        userOAuthTokens = await getUserOAuthTokens(user.id);
        if (userOAuthTokens) {
          console.log("Google Sheets export: Found user OAuth connection (Option B)", {
            usingTenantCredentials: !!tenantOAuthCreds,
            tenantId: tenantId || "none",
            isWorkspaceAdmin,
            hasServiceAccount,
          });
        }
      } catch (error: any) {
        console.warn("Google Sheets export: Failed to get OAuth tokens:", error.message);
      }
    }

    // Detect user account type for better error messages
    const accountType = await detectUserAccountType(user.id);
    // Update accountType with actual tenantId if we have it (fixes null tenantId issue)
    if (tenantId && accountType.tenantId === null) {
      accountType.tenantId = tenantId;
    }
    const recommendedMethod = await getRecommendedAuthMethod(user.id);
    
    // If neither service account nor OAuth tokens are available, provide helpful error
    if (!hasServiceAccount && !userOAuthTokens) {
      console.warn("Google Sheets export: No authentication method available", {
        hasServiceAccount,
        hasOAuthCredentials,
        hasUserOAuthTokens: !!userOAuthTokens,
        hasTenantOAuthCredentials: !!tenantOAuthCreds,
        hasPlatformOAuthCredentials: !!platformOAuthCreds,
        tenantId: tenantId || accountType.tenantId || null,
        accountType: {
          ...accountType,
          tenantId: tenantId || accountType.tenantId || null, // Ensure tenantId is set
        },
        recommendedMethod,
      });
      
      // Enhanced error message based on account type
      if (accountType.isCorporate) {
        return NextResponse.json(
          {
            error: "Google Sheets export requires authentication setup",
            error_code: "AUTH_REQUIRED",
            accountType: "corporate",
            guidance: hasServiceAccount
              ? "Please connect your Google account in Settings > Integrations > Google Sheets"
              : "Corporate export requires service account configuration. Please contact your administrator.",
            helpUrl: "/dashboard/integrations/google-sheets",
            fallbackAvailable: true,
          },
          { status: 400 }
        );
      } else {
        // Individual user - guide them to connect OAuth
        return NextResponse.json(
          {
            error: "Please connect your Google account to export to Google Sheets",
            error_code: "OAUTH_REQUIRED",
            accountType: "individual",
            guidance: "Connect your Google account in Settings > Integrations > Google Sheets",
            helpUrl: "/dashboard/integrations/google-sheets",
            fallbackAvailable: true,
          },
          { status: 400 }
        );
      }
    }
    
    // Fallback to CSV export if we reach here (shouldn't happen due to checks above, but TypeScript needs it)
    if (!hasServiceAccount && !userOAuthTokens && transactions) {
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

    // Initialize Google Sheets + Drive clients (tier-aware).
    let auth: any;
    let authMethod: "workspace_admin" | "service_account" | "oauth" = "oauth";
    let sheets: ReturnType<typeof google.sheets>;
    let tenantClients: any = null;

    try {
      tenantClients = await createTenantGoogleClientsForRequestUser();
      auth = tenantClients.auth;
      sheets = tenantClients.sheets;
      authMethod = tenantClients.authMethod === "dwd_service_account" ? "workspace_admin" : "oauth";
    } catch (e: any) {
      const msg = e?.message || "Failed to initialize Google clients";
      
      // For suspense accounts, try to fall back to user OAuth if Enterprise BYO fails
      if (isSuspenseAccount && msg.includes("dwdSubjectEmail")) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/google-sheets/route.ts:318',message:'Enterprise BYO failed for suspense account, trying OAuth fallback',data:{error:msg},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        try {
          // Try to use user OAuth tokens as fallback
          const userOAuthTokens = await getUserOAuthTokens(user.id);
          if (userOAuthTokens) {
            const oauthSheets = await createOAuthSheetsClient(user.id);
            auth = oauthSheets.auth;
            sheets = oauthSheets.sheets;
            authMethod = "oauth";
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/google-sheets/route.ts:326',message:'OAuth fallback successful for suspense account',data:{hasAuth:!!auth,hasSheets:!!sheets},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
          } else {
            throw new Error("No OAuth tokens available for fallback");
          }
        } catch (fallbackError: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/google-sheets/route.ts:332',message:'OAuth fallback failed for suspense account',data:{error:fallbackError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          // Check if this is an individual account trying to use enterprise BYO
          const cfg = await getTenantGoogleIntegrationConfig();
          const isIndividualAccount = cfg?.entityType === "individual";
          
          return NextResponse.json(
            {
              error: isIndividualAccount
                ? "Individual accounts cannot use Enterprise BYO credentials. Please connect your Google account in Settings > Integrations > Google Sheets instead."
                : "Enterprise BYO requires dwdSubjectEmail in tenant settings. For suspense accounts, please connect your Google account in Settings > Integrations > Google Sheets.",
              error_code: isIndividualAccount ? "INDIVIDUAL_ACCOUNT_BYO_ERROR" : "AUTH_INIT_ERROR",
              accountType: cfg?.entityType || "unknown",
              guidance: isIndividualAccount
                ? "Individual accounts should use personal Google OAuth. Connect your Google account in Settings > Integrations > Google Sheets."
                : "Please connect your Google account in Settings > Integrations > Google Sheets, or configure dwdSubjectEmail for Enterprise BYO.",
              helpUrl: "/dashboard/integrations/google-sheets",
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: msg,
            error_code: msg.includes("connect") ? "OAUTH_REQUIRED" : msg.includes("dwdSubjectEmail") ? "ENTERPRISE_BYO_CONFIG_ERROR" : "AUTH_INIT_ERROR",
            guidance: msg.includes("dwdSubjectEmail") 
              ? "Enterprise BYO requires dwdSubjectEmail in tenant settings. Please configure it in Company Setup or connect your Google account in Settings > Integrations > Google Sheets."
              : "Please connect your Google account in Settings > Integrations > Google Sheets.",
            helpUrl: "/dashboard/integrations/google-sheets",
          },
          { status: 400 }
        );
      }
    }

    const sharedDriveIdFromTenant = tenantClients?.sharedDriveId || null;
    const statementsFolderIdFromTenant = tenantClients?.sharedDriveFolders?.statementsFolderId || null;
    const hasSharedDriveConfig = !!(sharedDriveIdFromTenant || companyProfile?.google_shared_drive_id);

    // ========== SHARED DRIVE EXPORT PATH ==========
    // If company has shared drive configured, use master spreadsheet with tabs
    const effectiveSharedDriveId = sharedDriveIdFromTenant || companyProfile?.google_shared_drive_id || null;
    
    // For suspense accounts, allow export even without shared drive (use company master spreadsheet or create one)
    // Suspense accounts need to export unreconciled invoices to a spreadsheet
    if (tenantClients?.tier !== "consumer" && !effectiveSharedDriveId && !isSuspenseAccount) {
      return NextResponse.json(
        {
          error: "Company Shared Drive is not provisioned yet",
          error_code: "SHARED_DRIVE_NOT_PROVISIONED",
          guidance:
            "Run Shared Drive provisioning (Company Setup) so exports can be written to the company-owned Shared Drive.",
          helpUrl: "/dashboard/setup",
          provisionEndpoint: "/api/integrations/google-shared-drive/provision",
        },
        { status: 400 }
      );
    }
    
    // For suspense accounts without shared drive, try to use company master spreadsheet if available
    if (isSuspenseAccount && !effectiveSharedDriveId && companyProfile?.google_master_spreadsheet_id) {
      // Use the company master spreadsheet directly (individual OAuth mode)
      linkedSpreadsheetId = companyProfile.google_master_spreadsheet_id;
      linkedSpreadsheetSource = "company";
    }
    if (hasSharedDriveConfig && effectiveSharedDriveId) {
      console.log("Google Sheets export: Using Shared Drive mode", {
        driveId: effectiveSharedDriveId,
        driveName: companyProfile?.google_shared_drive_name || null,
        existingSpreadsheetId: companyProfile?.google_master_spreadsheet_id || null,
      });

      try {
        // Get or create master spreadsheet in shared drive
        const masterConfig = await getOrCreateMasterSpreadsheet(
          auth,
          effectiveSharedDriveId,
          statementsFolderIdFromTenant || effectiveSharedDriveId,
          companyProfile?.google_master_spreadsheet_id || undefined,
          companyProfile?.google_master_spreadsheet_name || undefined
        );

        // Update company profile with spreadsheet ID if it was newly created
        if (companyProfile?.id && masterConfig.spreadsheetId !== companyProfile.google_master_spreadsheet_id) {
          await supabase
            .from("company_profiles")
            .update({
              google_master_spreadsheet_id: masterConfig.spreadsheetId,
              google_master_spreadsheet_name: masterConfig.spreadsheetName,
            })
            .eq("id", companyProfile.id);
        }

        // Also persist to tenant integration settings (canonical for multi-user tenants)
        if (tenantId) {
          const { data: tis } = await (supabase as any)
            .from("tenant_integration_settings")
            .select("settings, use_custom_credentials, is_enabled, default_sharing_permission")
            .eq("tenant_id", tenantId)
            .eq("provider", "google_sheets")
            .maybeSingle();

          const updatedSettings = {
            ...(tis?.settings || {}),
            googleMasterSpreadsheetId: masterConfig.spreadsheetId,
            googleMasterSpreadsheetName: masterConfig.spreadsheetName,
          };

          await (supabase as any)
            .from("tenant_integration_settings")
            .upsert(
              {
                tenant_id: tenantId,
                provider: "google_sheets",
                settings: updatedSettings,
                use_custom_credentials: tis?.use_custom_credentials ?? false,
                is_enabled: tis?.is_enabled ?? true,
                default_sharing_permission: tis?.default_sharing_permission ?? "writer",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,provider" }
            );
        }

        // Generate fingerprint for each transaction
        const transactionsWithFingerprints: TransactionRow[] = transactions
          .map((tx: any) => {
            // Create unique fingerprint from date + description + amount
            const fingerprint = `${tx.date || ''}_${tx.original_description || ''}_${tx.amount || 0}`.toLowerCase().replace(/\s+/g, '_');
            
            return {
              date: tx.date || '',
              description: tx.original_description || '',
              amount: tx.amount || 0,
              category: tx.category || 'Uncategorized',
              subcategory: tx.subcategory || '',
              confidence: tx.confidence_score || 0,
              status: tx.user_confirmed ? 'Confirmed' : 'Pending',
              fingerprint,
            };
          });

        // Check if a tab already exists for this job (sync mode)
        const existingTab = await findExistingJobTab(auth, masterConfig.spreadsheetId, jobId);
        
        let finalTabName: string;
        let rowCount: number;
        let isSyncUpdate = false;

        if (existingTab) {
          // Sync/update existing tab
          console.log(`Google Sheets export: Found existing tab "${existingTab.tabName}" for job ${jobId}, syncing...`);
          isSyncUpdate = true;
          
          const result = await syncUploadTab(
            auth,
            masterConfig.spreadsheetId,
            existingTab.tabName,
            existingTab.sheetId,
            transactionsWithFingerprints,
            jobId
          );
          
          finalTabName = existingTab.tabName;
          rowCount = result.rowCount;
        } else {
          // Create new tab for this job
          // For suspense accounts, prefix tab name to indicate unreconciled status
          const baseName = job.original_filename || `Upload_${jobId.substring(0, 8)}`;
          const tabNamePrefix = isSuspenseAccount ? "Suspense - " : "";
          const tabName = generateTabName(
            `${tabNamePrefix}${baseName}`,
            new Date()
          );

          const result = await addUploadTab(
            auth,
            masterConfig.spreadsheetId,
            tabName,
            transactionsWithFingerprints,
            jobId // Pass job ID for future sync lookups
          );
          
          finalTabName = result.tabName;
          rowCount = result.rowCount;

          // Append fingerprints to tracking tab (only for new tabs)
          const fingerprintRecords = transactionsWithFingerprints.map((tx, idx) => ({
            fingerprint: tx.fingerprint,
            tabName: finalTabName,
            rowNumber: idx + 2, // +2 for 1-indexed and header row
          }));
          await appendFingerprints(auth, masterConfig.spreadsheetId, fingerprintRecords);
        }

        // Rebuild All Transactions tab
        const { totalRows } = await rebuildAllTransactionsTab(auth, masterConfig.spreadsheetId);

        // Store spreadsheet_id in job record for reference
        await supabase
          .from("categorization_jobs")
          .update({ spreadsheet_id: masterConfig.spreadsheetId })
          .eq("id", jobId)
          .eq("user_id", user.id);

        console.log(`Google Sheets export: Shared Drive export complete. Tab: ${finalTabName}, Rows: ${rowCount}, Total: ${totalRows}, Sync: ${isSyncUpdate}`);

        return NextResponse.json({
          success: true,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${masterConfig.spreadsheetId}`,
          spreadsheetId: masterConfig.spreadsheetId,
          message: isSyncUpdate 
            ? `Synced ${rowCount} transaction(s) to existing "${finalTabName}" tab.`
            : `Created "${finalTabName}" tab with ${rowCount} transaction(s).`,
          isNewSheet: false,
          isSyncUpdate,
          tabName: finalTabName,
          rowsAppended: rowCount,
          totalTransactions: totalRows,
          authMethod,
          exportMode: "shared_drive",
        });

      } catch (sharedDriveError: any) {
        console.error("Google Sheets export: Shared Drive export failed:", sharedDriveError);
        
        // Check if it's a permission error
        if (sharedDriveError.code === 403) {
          const permissionGuidance =
            tenantClients?.authMethod === "oauth_tenant_admin"
              ? "Please ensure the connected Workspace admin has permission to create/manage Shared Drives and granted Drive access. Try disconnecting/reconnecting Google Sheets integration."
              : "Please ensure Domain-Wide Delegation is configured and the impersonated Workspace admin can create/manage Shared Drives.";
          return NextResponse.json({
            error: "Permission denied accessing Shared Drive",
            error_code: "SHARED_DRIVE_PERMISSION_DENIED",
            guidance: permissionGuidance,
            helpUrl: "/dashboard/setup",
          }, { status: 403 });
        }

        return NextResponse.json({
          error: `Shared Drive export failed: ${sharedDriveError.message}`,
          error_code: "SHARED_DRIVE_ERROR",
          guidance: "You can try removing the Shared Drive configuration in Company Setup to use personal Drive instead.",
          helpUrl: "/dashboard/setup",
        }, { status: 500 });
      }
    }
    // ========== END SHARED DRIVE EXPORT PATH ==========

    // Check for linked spreadsheet (job > bank account > company > new)
    // linkedSpreadsheetId and linkedSpreadsheetSource were set earlier
    let spreadsheetId: string | null = null;
    let isNewSheet = false;
    let existingSheetData: any = null;
    let lastRowWithData = 0;

    // Use linked spreadsheet if available
    if (linkedSpreadsheetId) {
      // Try to access existing spreadsheet
      try {
        const spreadsheetMetadata = await sheets.spreadsheets.get({
          spreadsheetId: linkedSpreadsheetId,
        });
        
        if (spreadsheetMetadata.data) {
          spreadsheetId = linkedSpreadsheetId;
          console.log(`Google Sheets export: Using ${linkedSpreadsheetSource} spreadsheet ${spreadsheetId}`);
          
          // Try to read existing data to check structure
          try {
            if (!spreadsheetId) {
              throw new Error("Spreadsheet ID is null");
            }
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
        console.warn(`Google Sheets export: Cannot access linked spreadsheet ${linkedSpreadsheetId}:`, accessError.message);
        // Spreadsheet doesn't exist or is inaccessible, will create new one
        spreadsheetId = null;
        linkedSpreadsheetSource = "new";
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
        // Enhanced error handling based on error type
        const errorCode = createError.code || "UNKNOWN_ERROR";
        const isPermissionError = errorCode === 403 || createError.message?.includes("permission");
        const isQuotaError = errorCode === 429 || createError.message?.includes("quota");
        
        let errorMessage = `Failed to create spreadsheet: ${createError.message}`;
        let guidance = "";
        
        if (isPermissionError) {
          if (authMethod === "workspace_admin") {
            errorMessage = "Service account does not have permission to create spreadsheets";
            guidance = accountType.isCorporate
              ? "The service account needs domain-wide delegation configured in Google Workspace Admin Console, or the Google Drive API may not be enabled. You can also connect your personal Google account as an alternative."
              : "The service account lacks permissions. Please connect your personal Google account in Settings > Integrations > Google Sheets as an alternative.";
          } else {
            errorMessage = "Your Google account does not have permission to create spreadsheets";
            guidance = "Please ensure your Google account has permission to create Google Sheets, or try reconnecting in Settings > Integrations.";
          }
        } else if (isQuotaError) {
          errorMessage = "Google Sheets API quota exceeded";
          guidance = "Please try again later or contact support if this persists.";
        }
        
        return NextResponse.json(
          {
            error: errorMessage,
            error_code: isPermissionError ? "PERMISSION_DENIED" : isQuotaError ? "QUOTA_EXCEEDED" : "CREATE_ERROR",
            authMethod,
            guidance,
            helpUrl: "/dashboard/integrations/google-sheets",
            fallbackAvailable: true,
          },
          { status: 500 }
        );
      }

      spreadsheetId = spreadsheet.data.spreadsheetId || null;
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

    // For existing sheets, we'll SYNC (replace all data) instead of appending
    // This ensures the spreadsheet always reflects the current state of the job
    let shouldWriteHeaders = isNewSheet;
    let isSyncUpdate = false;
    
    if (!isNewSheet && existingSheetData.length > 0) {
      const existingHeaders = existingSheetData[0];
      // Check if headers match (case-insensitive comparison)
      const headersMatch = existingHeaders && 
        existingHeaders.length === expectedHeaders.length &&
        existingHeaders.every((h: string, i: number) => 
          h?.toString().toLowerCase().trim() === expectedHeaders[i]?.toLowerCase().trim()
        );
      
      if (headersMatch) {
        // Headers match, we'll sync (clear and replace data)
        shouldWriteHeaders = false;
        isSyncUpdate = true;
        console.log(`Google Sheets export: Headers match, syncing data (replacing existing)`);
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
      console.log("Google Sheets export: Sheet exists but is empty, writing headers + data");
    }

    // If syncing, clear existing data first (keep header row)
    if (isSyncUpdate && spreadsheetId) {
      try {
        // Clear all data from row 2 onwards
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: "Sheet1!A2:Z10000",
        });
        console.log("Google Sheets export: Cleared existing data for sync");
      } catch (clearError: any) {
        console.warn("Google Sheets export: Could not clear existing data:", clearError.message);
        // Continue anyway - overwrite will work
      }
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
    // For sync updates, we cleared the data but keep headers, so write from row 2
    // For new sheets, write headers + data from row 1
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

    // Determine range: new sheet starts at row 1, sync updates start at row 2
    const startRow = shouldWriteHeaders ? 1 : 2;
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
        
        // Also link the new sheet to the bank account if it doesn't have one
        if (job.bank_account_id && linkedSpreadsheetSource === "new") {
          const { error: bankUpdateError } = await supabase
            .from("bank_accounts")
            .update({ default_spreadsheet_id: spreadsheetId })
            .eq("id", job.bank_account_id)
            .is("default_spreadsheet_id", null); // Only update if not already linked
          
          if (!bankUpdateError) {
            console.log(`Google Sheets export: Linked new spreadsheet to bank account ${job.bank_account_id}`);
            linkedSpreadsheetSource = "bank_account"; // Update for response
          }
        }
      } catch (dbError: any) {
        console.error("Google Sheets export: Error storing spreadsheet_id:", dbError);
        // Don't fail the export - spreadsheet was created successfully
      }
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    console.log(
      `Google Sheets export: Export completed successfully using ${
        authMethod === "workspace_admin"
          ? "service account (Option A - Corporate)"
          : "user OAuth (Option B - Individual)"
      }, sync=${isSyncUpdate}`
    );

    return NextResponse.json({
      success: true,
      sheetUrl,
      spreadsheetId,
      message: isNewSheet 
        ? "Google Sheet created successfully" 
        : isSyncUpdate
          ? `Successfully synced ${transactionRows.length} transaction(s) to existing Google Sheet`
          : `Successfully updated Google Sheet with ${transactionRows.length} transaction(s)`,
      isNewSheet,
      isSyncUpdate,
      rowsWritten: transactionRows.length,
      authMethod,
      // Include info about linked source for UI feedback
      linkedFrom: linkedSpreadsheetSource,
      bankAccountName: bankAccountName || null,
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
