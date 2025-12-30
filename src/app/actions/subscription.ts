"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { requirePermission } from "@/core/permissions/middleware";
import type { Database } from "@/core/database";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

export type SubscriptionType = "individual" | "company" | "enterprise";

export interface SubscriptionInfo {
  subscriptionType: SubscriptionType | null;
  availableAuthMethods: string[];
  canUpgradeToEnterprise: boolean;
}

/**
 * Get current subscription type for the tenant
 */
export async function getSubscriptionType(): Promise<{
  success: boolean;
  subscriptionType?: SubscriptionType | null;
  error?: string;
}> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();
    const { data: tenant, error } = await adminClient
      .from("tenants")
      .select("subscription_type")
      .eq("id", tenantId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      subscriptionType: (tenant?.subscription_type as SubscriptionType | null) || null,
    };
  } catch (error) {
    console.error("Error fetching subscription type:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch subscription type",
    };
  }
}

/**
 * Get available authentication methods based on subscription type
 */
export async function getAvailableAuthMethods(): Promise<{
  success: boolean;
  authMethods?: string[];
  error?: string;
}> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const subscriptionResult = await getSubscriptionType();
    if (!subscriptionResult.success || !subscriptionResult.subscriptionType) {
      return {
        success: false,
        error: subscriptionResult.error || "Failed to get subscription type",
      };
    }

    const subscriptionType = subscriptionResult.subscriptionType;
    const authMethods: string[] = [];

    switch (subscriptionType) {
      case "individual":
        authMethods.push("oauth");
        break;
      case "company":
        authMethods.push("oauth", "byo_credentials", "company_credentials");
        break;
      case "enterprise":
        authMethods.push("byo_credentials");
        break;
    }

    return { success: true, authMethods };
  } catch (error) {
    console.error("Error fetching available auth methods:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch auth methods",
    };
  }
}

/**
 * Check if tenant can upgrade to Enterprise
 * Requires tenant-specific Google credentials to be configured
 */
export async function canUpgradeToEnterprise(): Promise<{
  success: boolean;
  canUpgrade?: boolean;
  reason?: string;
  error?: string;
}> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    // Check if tenant has Google OAuth credentials configured
    const adminClient = createAdminClient();
    const { data: credentials, error } = await adminClient
      .from("tenant_oauth_credentials")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", "google")
      .eq("credential_type", "corporate")
      .eq("is_active", true)
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    const hasCredentials = credentials && credentials.length > 0;

    return {
      success: true,
      canUpgrade: hasCredentials,
      reason: hasCredentials
        ? "Google credentials are configured"
        : "Google credentials must be configured before upgrading to Enterprise",
    };
  } catch (error) {
    console.error("Error checking Enterprise upgrade eligibility:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check upgrade eligibility",
    };
  }
}

/**
 * Validate Enterprise credentials are configured
 */
export async function validateEnterpriseCredentials(): Promise<{
  success: boolean;
  isValid?: boolean;
  error?: string;
}> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();
    const { data: credentials, error } = await adminClient
      .from("tenant_oauth_credentials")
      .select("id, client_id, client_secret")
      .eq("tenant_id", tenantId)
      .eq("provider", "google")
      .eq("credential_type", "corporate")
      .eq("is_active", true)
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    const hasValidCredentials =
      credentials &&
      credentials.length > 0 &&
      credentials[0].client_id &&
      credentials[0].client_secret;

    return {
      success: true,
      isValid: !!hasValidCredentials,
    };
  } catch (error) {
    console.error("Error validating Enterprise credentials:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate credentials",
    };
  }
}

/**
 * Update subscription type
 * Individual ↔ Company: Simple update (no verification needed)
 * Enterprise: Requires credential verification and explicit confirmation
 */
export async function updateSubscriptionType(
  newType: SubscriptionType,
  options?: { skipVerification?: boolean }
): Promise<{
  success: boolean;
  subscriptionType?: SubscriptionType;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    // For Enterprise, verify credentials unless explicitly skipped
    if (newType === "enterprise" && !options?.skipVerification) {
      const validationResult = await validateEnterpriseCredentials();
      if (!validationResult.success || !validationResult.isValid) {
        return {
          success: false,
          error:
            "Enterprise requires Google credentials to be configured. Please set up your credentials first.",
        };
      }
    }

    const adminClient = createAdminClient();
    const { data: tenant, error } = await adminClient
      .from("tenants")
      .update({ subscription_type: newType } as TenantUpdate)
      .eq("id", tenantId)
      .select("subscription_type")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      subscriptionType: tenant?.subscription_type as SubscriptionType,
    };
  } catch (error) {
    console.error("Error updating subscription type:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update subscription type",
    };
  }
}

/**
 * Get complete subscription info including type and available auth methods
 */
export async function getSubscriptionInfo(): Promise<{
  success: boolean;
  info?: SubscriptionInfo;
  error?: string;
}> {
  try {
    const [typeResult, authMethodsResult, enterpriseCheckResult] = await Promise.all([
      getSubscriptionType(),
      getAvailableAuthMethods(),
      canUpgradeToEnterprise(),
    ]);

    if (!typeResult.success) {
      return { success: false, error: typeResult.error };
    }

    return {
      success: true,
      info: {
        subscriptionType: typeResult.subscriptionType || null,
        availableAuthMethods: authMethodsResult.authMethods || [],
        canUpgradeToEnterprise: enterpriseCheckResult.canUpgrade || false,
      },
    };
  } catch (error) {
    console.error("Error fetching subscription info:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch subscription info",
    };
  }
}

