"use server";

import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

// Server-side telemetry logger
function logAuthEvent(event: string, data?: Record<string, any>) {
  try {
    // Write to Cursor debug log endpoint
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'auth-session',
        runId: 'signup-flow',
        hypothesisId: 'AUTH',
        location: 'apps/portal/app/actions/auth.ts',
        message: `auth.${event}`,
        data: { event, ...data },
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Ignore fetch errors
    });

    // Also write to file
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(process.cwd(), '.cursor/debug.log');
      const logLine = JSON.stringify({
        sessionId: 'auth-session',
        runId: 'signup-flow',
        hypothesisId: 'AUTH',
        location: 'apps/portal/app/actions/auth.ts',
        message: `auth.${event}`,
        data: { event, ...data },
        timestamp: Date.now(),
      }) + '\n';
      fs.appendFileSync(logPath, logLine, { flag: 'a' });
    } catch {
      // Ignore file write errors
    }
  } catch {
    // Ignore all errors
  }
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  tenantDomain: string;
  plan?: string;
  region?: string;
  subscriptionType?: "individual" | "company" | "enterprise";
}

export type SignUpErrorCode =
  | "ACCOUNT_EXISTS"
  | "TENANT_DOMAIN_EXISTS"
  | "UNKNOWN";

export type SignUpResult =
  | { ok: true; data: { user: any; tenant: any; session: any } }
  | { ok: false; error: { code: SignUpErrorCode; message: string } };

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user and create their tenant
 * This is a server action that uses the admin client to bypass RLS
 */
export async function signUp(data: SignUpData): Promise<SignUpResult> {
  logAuthEvent('signup_start', {
    emailPrefix: data.email.substring(0, 5) + '***',
    tenantDomain: data.tenantDomain,
    subscriptionType: data.subscriptionType,
  });

  const adminClient = createAdminClient();

  try {
    // 1. Check if tenant already exists, if so use it
    let tenant: any = null;
    let isNewTenant = false;

    // Use admin client to bypass RLS when checking for existing tenant
    let existingTenant = null;
    let checkError = null;

    try {
      const result = await adminClient
        .from("tenants")
        .select("*")
        .eq("domain", data.tenantDomain)
        .maybeSingle();

      existingTenant = result.data;
      checkError = result.error;
    } catch (err: any) {
      checkError = err;
      console.error("Error checking for existing tenant:", err);
    }

    // If we get a function error, try to query without RLS by using a different approach
    if (checkError?.code === "42P17") {
      console.warn("Function error detected, trying alternative query method...");
      // Try querying all tenants and filtering in code (admin client should bypass RLS)
      try {
        const result: { data: any[] | null; error: any } = await adminClient
          .from("tenants")
          .select("*");

        const allTenants = result.data;
        const altError = result.error;

        if (!altError && allTenants) {
          existingTenant = allTenants.find((t: any) => t.domain === data.tenantDomain) || null;
          checkError = null;
        }
      } catch (altErr) {
        console.error("Alternative query also failed:", altErr);
      }
    } else if (checkError && checkError.code !== "42P17") {
      throw checkError;
    }

    if (existingTenant) {
      // Tenant exists, use it
      tenant = existingTenant;
      console.log("Using existing tenant:", tenant.id);
    } else {
      // Create new tenant
      const tenantData: any = {
        name: data.tenantName,
        domain: data.tenantDomain,
        plan: data.plan || "starter",
        region: data.region || "us-east-1",
        status: "pending",
        subscription_type: data.subscriptionType || "individual",
      };

      let result: { data: any | null; error: any } = await adminClient
        .from("tenants")
        .insert(tenantData)
        .select()
        .single();

      let newTenant = result.data;
      let tenantError = result.error;

      // Handle PGRST204 error (column not found) - retry without subscription_type
      if (tenantError && (tenantError.code === "PGRST204" || tenantError.message?.includes("subscription_type") || tenantError.message?.includes("Could not find the 'subscription_type'"))) {
        // Retry without subscription_type column
        const { subscription_type, ...tenantDataWithoutSubscriptionType } = tenantData;
        result = await adminClient
          .from("tenants")
          .insert(tenantDataWithoutSubscriptionType)
          .select()
          .single();

        newTenant = result.data;
        tenantError = result.error;
      }

      if (tenantError || !newTenant) {
        // Handle unique constraint violation (domain already exists)
        if (tenantError?.code === "23505") {
          // Try to get the existing tenant
          const existingResult: { data: any | null; error: any } = await adminClient
            .from("tenants")
            .select("*")
            .eq("domain", data.tenantDomain)
            .single();

          const existing = existingResult.data;
          if (existing) {
            tenant = existing;
          } else {
            return {
              ok: false,
              error: {
                code: "TENANT_DOMAIN_EXISTS",
                message:
                  "That organization domain is already in use. Please choose a different domain.",
              },
            };
          }
        } else {
          throw tenantError || new Error("Failed to create tenant");
        }
      } else {
        tenant = newTenant;
        isNewTenant = true; // Mark as newly created
      }
    }

    // 2. Sign up user with Supabase Auth using admin client
    const { data: authData, error: authError } = await adminClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          tenant_id: tenant.id,
        },
      },
    });

    if (authError || !authData.user) {
      // If auth fails and we created a NEW tenant, clean it up
      // Don't delete existing tenants!
      if (isNewTenant) {
        try {
          await adminClient.from("tenants").delete().eq("id", tenant.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup tenant:", cleanupError);
        }
      }

      // Handle unique constraint violation (email already exists)
      if (
        authError?.message?.includes("already registered") ||
        authError?.message?.includes("already exists") ||
        authError?.message?.includes("User already registered") ||
        authError?.status === 422
      ) {
        return {
          ok: false,
          error: {
            code: "ACCOUNT_EXISTS",
            message: "This account already exists. Would you like to sign in?",
          },
        };
      }

      throw authError || new Error("Failed to create user");
    }

    // 3. Create user record in users table using admin client
    // Get default "Organization Admin" role
    const roleResult: { data: { id: string } | null; error: any } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Organization Admin")
      .single();

    const defaultRole = roleResult.data;

    // Regular users belong to their tenant
    const userData: any = {
      id: authData.user.id,
      email: data.email,
      full_name: data.fullName,
      tenant_id: tenant.id,
      role_id: defaultRole?.id || null,
      plan: data.plan || "starter",
      status: "active",
    };

    const userResult: { data: any | null; error: any } = await adminClient
      .from("users")
      .insert(userData)
      .select()
      .single();

    const user = userResult.data;
    const userError = userResult.error;

    if (userError || !user) {
      // If user creation fails, clean up ONLY if we created a new tenant
      // Don't delete existing tenants!
      if (isNewTenant) {
        try {
          await adminClient.from("tenants").delete().eq("id", tenant.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup tenant:", cleanupError);
        }
      }

      // Always try to clean up auth user if it was created
      if (authData.user) {
        try {
          await adminClient.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          // Ignore delete errors during cleanup
          console.error("Failed to delete auth user during cleanup:", deleteError);
        }
      }

      // Handle unique constraint violation (email already exists)
      if (
        userError?.code === "23505" ||
        userError?.message?.includes("duplicate") ||
        userError?.message?.includes("unique") ||
        userError?.message?.includes("already exists")
      ) {
        return {
          ok: false,
          error: {
            code: "ACCOUNT_EXISTS",
            message: "This account already exists. Would you like to sign in?",
          },
        };
      }

      throw userError || new Error("Failed to create user record");
    }

    logAuthEvent('signup_success', {
      userId: user?.id?.substring(0, 8) || null,
      tenantId: tenant?.id?.substring(0, 8) || null,
      emailPrefix: data.email.substring(0, 5) + '***',
    });

    return { ok: true, data: { user, tenant, session: authData.session } };
  } catch (error) {
    logAuthEvent('signup_error', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor?.name : typeof error,
      emailPrefix: data.email.substring(0, 5) + '***',
    });
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
      timestamp: new Date().toISOString(),
    };

    console.error("Signup error:", error);
    console.error("Signup error details:", errorDetails);

    // Also write to log file for debugging
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(process.cwd(), '.logs');
      const logFile = path.join(logDir, 'server.log');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] [SIGNUP ERROR] ${JSON.stringify(errorDetails, null, 2)}\n`);
    } catch (logError) {
      // Ignore log file errors
    }
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: error instanceof Error ? error.message : "We couldn't create your account. Please try again.",
      },
    };
  }
}
