import type { Metadata } from "next";
import React from "react";
import SettingsHeader from "@/components/ai-customer-care/SettingsHeader";
import GeneralSettings from "@/components/ai-customer-care/GeneralSettings";
import SystemConfiguration from "@/components/ai-customer-care/SystemConfiguration";
import SecuritySettings from "@/components/ai-customer-care/SecuritySettings";
import NotificationSettings from "@/components/ai-customer-care/NotificationSettings";
import BackupSettings from "@/components/ai-customer-care/BackupSettings";

export const metadata: Metadata = {
  title:
    "System Settings | TinAdmin - AI Customer Care Dashboard",
  description: "Configure system settings, security, notifications, and backup options for AI customer care operations.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsHeader />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-6">
          <GeneralSettings />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <SystemConfiguration />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <SecuritySettings />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <NotificationSettings />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-6">
          <BackupSettings />
        </div>
        <div className="col-span-12 lg:col-span-6">
          {/* Additional settings component can go here */}
        </div>
      </div>
    </div>
  );
}
