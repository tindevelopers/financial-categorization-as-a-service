import { redirect } from "next/navigation";

export default function LegacyEnterpriseOAuthPage() {
  redirect("/dashboard/enterprise-admin/enterprise-oauth");
}


