import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";
import { getSubdomainFromRequest } from "@/core/multi-tenancy/subdomain-routing";
import ConsumerLayout from "@/layout/ConsumerLayout";
import HeroSection from "@/components/consumer/HeroSection";
import FeaturesSection from "@/components/consumer/FeaturesSection";
import HowItWorks from "@/components/consumer/HowItWorks";
import PricingSection from "@/components/consumer/PricingSection";
import CTASection from "@/components/consumer/CTASection";

export default async function RootPage() {
  try {
    // Check subdomain to determine routing
    const subdomainInfo = await getSubdomainFromRequest();
    
    // Debug logging (remove in production if needed)
    console.log("[RootPage] Subdomain info:", {
      subdomain: subdomainInfo.subdomain,
      domain: subdomainInfo.domain,
    });
    
    // Only treat "admin" subdomain as admin route
    // Everything else (no subdomain, or other subdomains) shows consumer landing page
    const isAdminSubdomain = subdomainInfo.subdomain === 'admin';
    
    if (!isAdminSubdomain) {
      // Show consumer landing page for:
      // - No subdomain (domain.com)
      // - Any subdomain that's not "admin"
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // User is authenticated, redirect to dashboard
      redirect("/saas/dashboard");
    } else {
      // User is not authenticated, redirect to sign in
      redirect("/signin");
    }
  } catch (error) {
    // If there's any error, show consumer landing page as fallback
    console.error("Error checking authentication:", error);
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
