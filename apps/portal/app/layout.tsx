import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SaaS Platform - Consumer Portal",
  description: "Consumer-facing portal for SaaS platform",
};

/**
 * Root Layout for Consumer Portal
 * 
 * Note: TenantProvider and OrganizationProvider will be added
 * when the city portal features are developed.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}

