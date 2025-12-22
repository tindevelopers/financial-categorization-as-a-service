import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";
import { getSubdomainFromRequest } from "@/core/multi-tenancy/subdomain-routing";
import ConsumerLayout from "@/layout/ConsumerLayout";
import HeroSection from "@/components/consumer/HeroSection";
import FeaturesSection from "@/components/consumer/FeaturesSection";
import HowItWorks from "@/components/consumer/HowItWorks";
import PricingSection from "@/components/consumer/PricingSection";
import CTASection from "@/components/consumer/CTASection";

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  try {
    // Check if user is authenticated FIRST - authenticated users should always go to dashboard
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // User is authenticated - get user details to determine the right dashboard
      const userResult: { 
        data: { 
          id: string; 
          email: string; 
          tenant_id: string | null; 
          roles: { name: string; coverage: string } | null 
        } | null; 
        error: any 
      } = await supabase
        .from("users")
        .select(`
          id,
          email,
          tenant_id,
          roles:role_id (
            name,
            coverage
          )
        `)
        .eq("id", user.id)
        .single();
      
      const userData = userResult.data;
      const roleName = userData?.roles?.name;
      
      console.log("[RootPage] Authenticated user detected:", {
        email: user.email,
        role: roleName,
        tenantId: userData?.tenant_id,
      });
      
      // Platform Admins go to the SaaS dashboard
      if (roleName === "Platform Admin") {
        console.log("[RootPage] Platform Admin, redirecting to SaaS dashboard");
        redirect("/saas/dashboard");
      }
      
      // All other authenticated users (Organization Admins, etc.) go to the main dashboard
      console.log("[RootPage] Authenticated user, redirecting to dashboard");
      redirect("/dashboard");
    }
    
    // User is NOT authenticated - check subdomain for routing
    const subdomainInfo = await getSubdomainFromRequest();
    
    console.log("[RootPage] Anonymous user - Subdomain info:", {
      subdomain: subdomainInfo.subdomain,
      domain: subdomainInfo.domain,
      isAdmin: subdomainInfo.subdomain === 'admin',
    });
    
    // Only treat "admin" subdomain as admin route
    const isAdminSubdomain = subdomainInfo.subdomain === 'admin';
    
    if (isAdminSubdomain) {
      // Admin subdomain for unauthenticated user - redirect to sign in
      console.log("[RootPage] Admin subdomain, unauthenticated - redirecting to signin");
      redirect("/signin");
    }
    
    // Show consumer landing page for unauthenticated users
    console.log("[RootPage] Showing consumer landing page for anonymous user");
    return (
      <ConsumerLayout>
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <CTASection />
      </ConsumerLayout>
    );
  } catch (error) {
    // If there's any error, show consumer landing page as fallback
    console.error("[RootPage] Error:", error);
    return (
      <ConsumerLayout>
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <CTASection />
      </ConsumerLayout>
    );
  }
}
