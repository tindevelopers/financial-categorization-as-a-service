import type { Metadata } from "next";
import React from "react";
import QualityHeader from "@/components/ai-customer-care/QualityHeader";
import QualityMetrics from "@/components/ai-customer-care/QualityMetrics";
import CallScoring from "@/components/ai-customer-care/CallScoring";
import ComplianceMonitoring from "@/components/ai-customer-care/ComplianceMonitoring";
import QualityTrends from "@/components/ai-customer-care/QualityTrends";
import AgentPerformance from "@/components/ai-customer-care/AgentPerformance";
import QualityReports from "@/components/ai-customer-care/QualityReports";

export const metadata: Metadata = {
  title:
    "Quality Assurance & Compliance | TinAdmin - AI Customer Care Dashboard",
  description: "Monitor call quality, compliance metrics, and agent performance for AI customer care operations.",
};

export default function QualityAssurancePage() {
  return (
    <div className="space-y-6">
      <QualityHeader />
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <QualityMetrics />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <CallScoring />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <ComplianceMonitoring />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-6">
          <QualityTrends />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <AgentPerformance />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <QualityReports />
        </div>
      </div>
    </div>
  );
}
