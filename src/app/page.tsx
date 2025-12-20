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
    // Check subdomain to determine routing
    const subdomainInfo = await getSubdomainFromRequest();
    
    console.log("[RootPage] Subdomain info:", {
      subdomain: subdomainInfo.subdomain,
      domain: subdomainInfo.domain,
      isAdmin: subdomainInfo.subdomain === 'admin',
    });
    
    // Only treat "admin" subdomain as admin route
    // Everything else (no subdomain, or other subdomains) shows consumer landing page
    const isAdminSubdomain = subdomainInfo.subdomain === 'admin';
    
    if (!isAdminSubdomain) {
      // For non-admin routes (localhost, domain.com, etc.), check if user is authenticated
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // User is authenticated - get user details to determine redirect
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
        const tenantId = userData?.tenant_id;
        
        // If authenticated consumer user, redirect to consumer portal
        if (roleName === "Organization Admin" && tenantId) {
          console.log("[RootPage] Authenticated consumer user, redirecting to consumer portal");
          redirect("/upload");
        } else if (roleName === "Platform Admin" && !tenantId) {
          // Platform Admin on consumer domain - redirect to admin dashboard
          console.log("[RootPage] Platform Admin on consumer domain, redirecting to admin dashboard");
          redirect("/saas/dashboard");
        }
      }
      
      // Show consumer landing page for:
      // - No subdomain (domain.com, localhost)
      // - Any subdomain that's not "admin"
      // - Unauthenticated users
      console.log("[RootPage] Showing consumer landing page");
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
    
    // If admin subdomain, use admin flow
    console.log("[RootPage] Admin subdomain detected, checking auth");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // User is authenticated, redirect to dashboard
      console.log("[RootPage] User authenticated, redirecting to dashboard");
      redirect("/saas/dashboard");
    } else {
      // User is not authenticated, redirect to sign in
      console.log("[RootPage] User not authenticated, redirecting to signin");
      redirect("/signin");
    }
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
