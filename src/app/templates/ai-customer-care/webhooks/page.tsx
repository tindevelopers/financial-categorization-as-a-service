import type { Metadata } from "next";
import React from "react";
import WebhookHeader from "@/components/ai-customer-care/WebhookHeader";
import WebhookList from "@/components/ai-customer-care/WebhookList";
import WebhookConfiguration from "@/components/ai-customer-care/WebhookConfiguration";
import WebhookLogs from "@/components/ai-customer-care/WebhookLogs";

export const metadata: Metadata = {
  title:
    "Webhook Management | TinAdmin - AI Customer Care Dashboard",
  description: "Configure real-time event notifications and API callbacks for AI customer care operations.",
};

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <WebhookHeader />
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <WebhookList />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <WebhookConfiguration />
        </div>
      </div>
      
      <WebhookLogs />
    </div>
  );
}
