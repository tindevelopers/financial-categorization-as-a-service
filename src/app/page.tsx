import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";
import { getSubdomainFromRequest } from "@/core/multi-tenancy/subdomain-routing";
import HeroSection from "@/components/consumer/HeroSection";
import FeaturesSection from "@/components/consumer/FeaturesSection";
import HowItWorks from "@/components/consumer/HowItWorks";
import PricingSection from "@/components/consumer/PricingSection";
import CTASection from "@/components/consumer/CTASection";

export default async function RootPage() {
  try {
    // Check subdomain to determine routing
    const subdomainInfo = await getSubdomainFromRequest();
    
    // If no subdomain (domain.com), show consumer landing page
    if (!subdomainInfo.subdomain || subdomainInfo.subdomain === '') {
      return (
        <>
          <HeroSection />
          <FeaturesSection />
          <HowItWorks />
          <PricingSection />
          <CTASection />
        </>
      );
    }
    
    // If admin subdomain or other subdomain, use admin flow
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
      <>
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <CTASection />
      </>
    );
  }
}
