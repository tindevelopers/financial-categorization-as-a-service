import type { Metadata } from "next";
import React from "react";
import CallFlowBuilder from "@/components/ai-customer-care/CallFlowBuilder";
import FlowTemplates from "@/components/ai-customer-care/FlowTemplates";
import FlowProperties from "@/components/ai-customer-care/FlowProperties";
import FlowPreview from "@/components/ai-customer-care/FlowPreview";

export const metadata: Metadata = {
  title:
    "Call Flow Builder | TinAdmin - AI Customer Care Dashboard",
  description: "Visual call flow builder for designing and managing AI customer care conversation flows and IVR systems.",
};

export default function CallFlowBuilderPage() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 lg:col-span-3">
        <FlowTemplates />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <CallFlowBuilder />
      </div>
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <FlowProperties />
        <FlowPreview />
      </div>
    </div>
  );
}
