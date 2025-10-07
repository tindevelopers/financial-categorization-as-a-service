import type { Metadata } from "next";
import React from "react";
import PhoneNumbersHeader from "@/components/ai-customer-care/PhoneNumbersHeader";
import PhoneNumbersList from "@/components/ai-customer-care/PhoneNumbersList";
import PhoneNumberConfiguration from "@/components/ai-customer-care/PhoneNumberConfiguration";
import NumberSearch from "@/components/ai-customer-care/NumberSearch";

export const metadata: Metadata = {
  title:
    "Phone Number Management | TinAdmin - AI Customer Care Dashboard",
  description: "Manage inbound/outbound phone numbers, routing, and caller ID settings for AI customer care operations.",
};

export default function PhoneNumbersPage() {
  return (
    <div className="space-y-6">
      <PhoneNumbersHeader />
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <PhoneNumbersList />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PhoneNumberConfiguration />
        </div>
      </div>
      
      <NumberSearch />
    </div>
  );
}
