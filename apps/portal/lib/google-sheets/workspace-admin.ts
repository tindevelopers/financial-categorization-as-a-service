/**
 * Workspace Admin Helper
 * 
 * Handles Google Workspace domain-wide delegation and admin account management
 */

import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { google } from "googleapis";

export interface WorkspaceAdminInfo {
  isWorkspaceAdmin: boolean;
  workspaceDomain: string | null;
  accountType: "personal" | "workspace_admin";
  hasDomainWideDelegation: boolean;
}

/**
 * Get workspace admin information for a user's Google Sheets connection
 */
export async function getWorkspaceAdminInfo(userId: string): Promise<WorkspaceAdminInfo | null> {
  try {
    const supabase = await createClient();
    
    // Check cloud_storage_connections table
    const { data: connection } = await supabase
      .from("cloud_storage_connections")
      .select("account_type, workspace_domain, is_workspace_admin")
      .eq("user_id", userId)
      .eq("provider", "google_sheets")
      .eq("is_active", true)
      .single();

    if (!connection) {
      return null;
    }

    return {
      isWorkspaceAdmin: connection.is_workspace_admin || false,
      workspaceDomain: connection.workspace_domain || null,
      accountType: (connection.account_type as "personal" | "workspace_admin") || "personal",
      hasDomainWideDelegation: false, // Would need to check service account configuration
    };
  } catch (error: any) {
    console.error("Error getting workspace admin info:", error);
    return null;
  }
}

/**
 * Check if a service account has domain-wide delegation configured
 */
export async function checkDomainWideDelegation(tenantId?: string): Promise<boolean> {
  try {
    const credentialManager = getCredentialManager();
    const serviceAccountCreds = await credentialManager.getBestGoogleServiceAccount(tenantId);

    if (!serviceAccountCreds) {
      return false;
    }

    // Domain-wide delegation requires:
    // 1. Service account with domain-wide delegation enabled in Google Workspace Admin
    // 2. Proper scopes configured
    // 3. Subject (user email) for impersonation

    // This is a basic check - full implementation would verify with Google Admin SDK
    return !!serviceAccountCreds.email;
  } catch (error: any) {
    console.error("Error checking domain-wide delegation:", error);
    return false;
  }
}

/**
 * Create Google Sheets client with domain-wide delegation (for Workspace admin)
 */
export async function createWorkspaceAdminSheetsClient(
  userId: string,
  subjectEmail?: string
): Promise<{
  sheets: ReturnType<typeof google.sheets>;
  auth: any;
} | null> {
  try {
    const workspaceInfo = await getWorkspaceAdminInfo(userId);
    
    if (!workspaceInfo || !workspaceInfo.isWorkspaceAdmin) {
      return null;
    }

    const credentialManager = getCredentialManager();
    const supabase = await createClient();

    // If subjectEmail not provided, try to use the connected Workspace user email (from OAuth connection)
    // This is required for domain-wide delegation impersonation.
    if (!subjectEmail) {
      const { data: integration } = await supabase
        .from("user_integrations")
        .select("provider_email")
        .eq("user_id", userId)
        .eq("provider", "google_sheets")
        .single();

      subjectEmail = integration?.provider_email || undefined;
    }

    if (!subjectEmail) {
      console.warn("Workspace admin DWD requested but no subjectEmail available (no connected Workspace email found).");
      return null;
    }
    
    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    const serviceAccountCreds = await credentialManager.getBestGoogleServiceAccount(
      userData?.tenant_id || undefined
    );

    if (!serviceAccountCreds) {
      console.error("Service account credentials not found for workspace admin");
      return null;
    }

    // Create JWT client for domain-wide delegation
    const jwtClient = new google.auth.JWT({
      email: serviceAccountCreds.email,
      key: serviceAccountCreds.privateKey.replace(/\\n/g, "\n"),
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file", // Required for creating new spreadsheets
      ],
      subject: subjectEmail, // Impersonate this user (required for DWD)
    });

    await jwtClient.authorize();

    const sheets = google.sheets({ version: "v4", auth: jwtClient });

    return {
      sheets,
      auth: jwtClient,
    };
  } catch (error: any) {
    console.error("Error creating workspace admin sheets client:", error);
    return null;
  }
}

/**
 * Validate admin account permissions
 */
export async function validateAdminPermissions(
  userId: string,
  workspaceDomain: string
): Promise<{
  isValid: boolean;
  hasSheetsAccess: boolean;
  hasDriveAccess: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let hasSheetsAccess = false;
  let hasDriveAccess = false;

  try {
    const client = await createWorkspaceAdminSheetsClient(userId);
    
    if (!client) {
      errors.push("Failed to create workspace admin client");
      return {
        isValid: false,
        hasSheetsAccess: false,
        hasDriveAccess: false,
        errors,
      };
    }

    // Test Sheets API access
    try {
      await client.sheets.spreadsheets.get({
        spreadsheetId: "test", // This will fail but we can check the error
      });
      hasSheetsAccess = true;
    } catch (sheetsError: any) {
      if (sheetsError.code === 404) {
        // 404 means we have access but spreadsheet doesn't exist (expected)
        hasSheetsAccess = true;
      } else if (sheetsError.code === 403) {
        errors.push("No access to Google Sheets API");
      } else {
        // Other errors might indicate access issues
        hasSheetsAccess = true; // Assume access if it's not a permission error
      }
    }

    // Test Drive API access
    try {
      const drive = google.drive({ version: "v3", auth: client.auth });
      await drive.files.list({ pageSize: 1 });
      hasDriveAccess = true;
    } catch (driveError: any) {
      if (driveError.code === 403) {
        errors.push("No access to Google Drive API");
      } else {
        hasDriveAccess = true; // Assume access if it's not a permission error
      }
    }

    return {
      isValid: errors.length === 0,
      hasSheetsAccess,
      hasDriveAccess,
      errors,
    };
  } catch (error: any) {
    errors.push(`Validation failed: ${error.message}`);
    return {
      isValid: false,
      hasSheetsAccess: false,
      hasDriveAccess: false,
      errors,
    };
  }
}

