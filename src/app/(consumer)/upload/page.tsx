"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/core/database/client";
import SpreadsheetUpload from "@/components/consumer/SpreadsheetUpload";

export default function UploadPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/signin");
      }
    }

    checkAuth();
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-12">
      <SpreadsheetUpload />
    </div>
  );
}

