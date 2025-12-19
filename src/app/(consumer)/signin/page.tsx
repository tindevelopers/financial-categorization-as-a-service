import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";
import ConsumerSignInForm from "@/components/consumer/SignInForm";

export const metadata: Metadata = {
  title: "Sign In - FinanceCategorizer",
  description: "Sign in to your account to continue categorizing your bank transactions",
};

export default async function ConsumerSignIn() {
  // Check if user is already authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    redirect("/upload");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to continue categorizing your transactions
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <ConsumerSignInForm redirectTo="/upload" />
        </div>
      </div>
    </div>
  );
}

