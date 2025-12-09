"use server";

import { requirePermission } from "@/core/permissions/middleware";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { getCurrentUserTenantId } from "./validation";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

export interface BrandingSettings {
  companyName?: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export interface ThemeSettings {
  themeMode?: "light" | "dark" | "auto";
  fontFamily?: string;
  fontSize?: "small" | "medium" | "large";
  borderRadius?: "none" | "small" | "medium" | "large";
  enableAnimations?: boolean;
  enableRipple?: boolean;
}

export interface EmailSettings {
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  footerText?: string;
  headerLogo?: string;
  headerColor?: string;
  footerColor?: string;
}

export interface CustomDomain {
  domain: string;
  type: "primary" | "custom";
  status: "active" | "pending" | "failed";
  sslStatus: "valid" | "expired" | "pending";
  verified: boolean;
}

/**
 * Get white label branding settings for current tenant
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch (error) {
      // If permission check fails (e.g., not authenticated), return empty
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    const brandingResult: { data: { branding: any } | null; error: any } = await supabase
      .from("tenants")
      .select("branding")
      .eq("id", tenantId)
      .single();

    const tenant = brandingResult.data;
    if (brandingResult.error) {
      console.error("Error fetching branding settings:", brandingResult.error);
      return {};
    }

    return (tenant?.branding as BrandingSettings) || {};
  } catch (error) {
    console.error("Error in getBrandingSettings:", error);
    return {};
  }
}

/**
 * Save branding settings for current tenant
 */
export async function saveBrandingSettings(settings: BrandingSettings): Promise<{ success: boolean; error?: string }> {
  await requirePermission("settings.write");
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Not authenticated");
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    const updateResult: { error: any } = await ((supabase
      .from("tenants") as any)
      .update({ branding: settings } as any)
      .eq("id", tenantId));
    const error = updateResult.error;

    if (error) {
      console.error("Error saving branding settings:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in saveBrandingSettings:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to save branding settings" };
  }
}

/**
 * Get theme settings for current tenant
 */
export async function getThemeSettings(): Promise<ThemeSettings> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch (error) {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    const themeResult: { data: { theme_settings: any } | null; error: any } = await supabase
      .from("tenants")
      .select("theme_settings")
      .eq("id", tenantId)
      .single();

    const tenant = themeResult.data;
    if (themeResult.error) {
      console.error("Error fetching theme settings:", themeResult.error);
      return {};
    }

    return (tenant?.theme_settings as ThemeSettings) || {};
  } catch (error) {
    console.error("Error in getThemeSettings:", error);
    return {};
  }
}

/**
 * Save theme settings for current tenant
 */
export async function saveThemeSettings(settings: ThemeSettings): Promise<{ success: boolean; error?: string }> {
  await requirePermission("settings.write");
  
  try {
    const supabase = await createClient();
    const tenantId = await getCurrentUserTenantId();
    
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    const updateThemeResult: { error: any } = await ((supabase
      .from("tenants") as any)
      .update({ theme_settings: settings } as any)
      .eq("id", tenantId));
    const error = updateThemeResult.error;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save theme settings" };
  }
}

/**
 * Get email settings for current tenant
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch (error) {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    const emailResult: { data: { email_settings: any } | null; error: any } = await supabase
      .from("tenants")
      .select("email_settings")
      .eq("id", tenantId)
      .single();

    const tenant = emailResult.data;
    if (emailResult.error) {
      return {};
    }

    return (tenant?.email_settings as EmailSettings) || {};
  } catch (error) {
    return {};
  }
}

/**
 * Save email settings for current tenant
 */
export async function saveEmailSettings(settings: EmailSettings): Promise<{ success: boolean; error?: string }> {
  await requirePermission("settings.write");
  
  try {
    const supabase = await createClient();
    const tenantId = await getCurrentUserTenantId();
    
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    const updateEmailResult: { error: any } = await ((supabase
      .from("tenants") as any)
      .update({ email_settings: settings } as any)
      .eq("id", tenantId));
    const error = updateEmailResult.error;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save email settings" };
  }
}

/**
 * Get custom CSS for current tenant
 */
export async function getCustomCSS(): Promise<string> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return "";
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch (error) {
      return "";
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return "";
    }

    const cssResult: { data: { custom_css: string | null } | null; error: any } = await supabase
      .from("tenants")
      .select("custom_css")
      .eq("id", tenantId)
      .single();

    const tenant = cssResult.data;
    if (cssResult.error) {
      return "";
    }

    return tenant?.custom_css || "";
  } catch (error) {
    return "";
  }
}

/**
 * Save custom CSS for current tenant
 */
export async function saveCustomCSS(css: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission("settings.write");
  
  try {
    const supabase = await createClient();
    const tenantId = await getCurrentUserTenantId();
    
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    const updateCssResult: { error: any } = await ((supabase
      .from("tenants") as any)
      .update({ custom_css: css } as any)
      .eq("id", tenantId));
    const error = updateCssResult.error;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save custom CSS" };
  }
}

/**
 * Get custom domains for current tenant
 */
export async function getCustomDomains(): Promise<CustomDomain[]> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch (error) {
      return [];
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return [];
    }

    const domainsResult: { data: { custom_domains: any } | null; error: any } = await supabase
      .from("tenants")
      .select("custom_domains")
      .eq("id", tenantId)
      .single();

    const tenant = domainsResult.data;
    if (domainsResult.error) {
      return [];
    }

    return (tenant?.custom_domains as CustomDomain[]) || [];
  } catch (error) {
    return [];
  }
}

/**
 * Save custom domains for current tenant
 */
export async function saveCustomDomains(domains: CustomDomain[]): Promise<{ success: boolean; error?: string }> {
  await requirePermission("settings.write");
  
  try {
    const supabase = await createClient();
    const tenantId = await getCurrentUserTenantId();
    
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    const updateDomainsResult: { error: any } = await ((supabase
      .from("tenants") as any)
      .update({ custom_domains: domains } as any)
      .eq("id", tenantId));
    const error = updateDomainsResult.error;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save custom domains" };
  }
}

/**
 * Add a custom domain
 */
export async function addCustomDomain(domain: Omit<CustomDomain, "verified">): Promise<{ success: boolean; error?: string; data?: CustomDomain }> {
  await requirePermission("settings.write");
  
  try {
    const domains = await getCustomDomains();
    const newDomain: CustomDomain = {
      ...domain,
      verified: false,
    };
    
    const updatedDomains = [...domains, newDomain];
    const result = await saveCustomDomains(updatedDomains);
    
    if (result.success) {
      return { success: true, data: newDomain };
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add custom domain" };
  }
}

