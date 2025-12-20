"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// Inline createClient to avoid import issues
async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Ignore - called from Server Component
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Ignore - called from Server Component
        }
      },
    },
  });
}

// Inline getCurrentUserTenantId to avoid import issues
async function getCurrentUserTenantId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    return userData?.tenant_id || null;
  } catch {
    return null;
  }
}

/**
 * Get white label branding settings for current tenant
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase as any)
      .from("tenants")
      .select("branding")
      .eq("id", tenantId)
      .single();

    if (result.error) {
      console.error("Error fetching branding settings:", result.error);
      return {};
    }

    return (result.data?.branding as BrandingSettings) || {};
  } catch (error) {
    console.error("Error in getBrandingSettings:", error);
    return {};
  }
}

/**
 * Save branding settings for current tenant
 */
export async function saveBrandingSettings(settings: BrandingSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (supabase as any)
      .from("tenants")
      .update({ branding: settings })
      .eq("id", tenantId);

    if (updateResult.error) {
      console.error("Error saving branding settings:", updateResult.error);
      return { success: false, error: updateResult.error.message };
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase as any)
      .from("tenants")
      .select("theme_settings")
      .eq("id", tenantId)
      .single();

    if (result.error) {
      console.error("Error fetching theme settings:", result.error);
      return {};
    }

    return (result.data?.theme_settings as ThemeSettings) || {};
  } catch (error) {
    console.error("Error in getThemeSettings:", error);
    return {};
  }
}

/**
 * Save theme settings for current tenant
 */
export async function saveThemeSettings(settings: ThemeSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (supabase as any)
      .from("tenants")
      .update({ theme_settings: settings })
      .eq("id", tenantId);

    if (updateResult.error) {
      return { success: false, error: updateResult.error.message };
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase as any)
      .from("tenants")
      .select("email_settings")
      .eq("id", tenantId)
      .single();

    if (result.error) {
      return {};
    }

    return (result.data?.email_settings as EmailSettings) || {};
  } catch {
    return {};
  }
}

/**
 * Save email settings for current tenant
 */
export async function saveEmailSettings(settings: EmailSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (supabase as any)
      .from("tenants")
      .update({ email_settings: settings })
      .eq("id", tenantId);

    if (updateResult.error) {
      return { success: false, error: updateResult.error.message };
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return "";
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return "";
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase as any)
      .from("tenants")
      .select("custom_css")
      .eq("id", tenantId)
      .single();

    if (result.error) {
      return "";
    }

    return result.data?.custom_css || "";
  } catch {
    return "";
  }
}

/**
 * Save custom CSS for current tenant
 */
export async function saveCustomCSS(css: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (supabase as any)
      .from("tenants")
      .update({ custom_css: css })
      .eq("id", tenantId);

    if (updateResult.error) {
      return { success: false, error: updateResult.error.message };
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase as any)
      .from("tenants")
      .select("custom_domains")
      .eq("id", tenantId)
      .single();

    if (result.error) {
      return [];
    }

    return (result.data?.custom_domains as CustomDomain[]) || [];
  } catch {
    return [];
  }
}

/**
 * Save custom domains for current tenant
 */
export async function saveCustomDomains(domains: CustomDomain[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (supabase as any)
      .from("tenants")
      .update({ custom_domains: domains })
      .eq("id", tenantId);

    if (updateResult.error) {
      return { success: false, error: updateResult.error.message };
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
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

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

