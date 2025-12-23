import React from "react";

/**
 * SaaS Layout
 * 
 * This layout is a passthrough that inherits the admin layout from the parent.
 * The actual sidebar, header, and main content structure is provided by
 * the parent (admin)/layout.tsx to avoid duplication.
 */
export default function SaasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

