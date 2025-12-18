import ConsumerLayout from "@/layout/ConsumerLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SaaS Platform",
  description: "Consumer-facing SaaS platform",
};

export default function ConsumerRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConsumerLayout>{children}</ConsumerLayout>;
}

