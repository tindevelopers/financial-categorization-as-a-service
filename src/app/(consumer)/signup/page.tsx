import ConsumerSignUpForm from "@/components/consumer/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - FinanceCategorizer",
  description: "Create your account to start categorizing your bank transactions automatically",
};

export default function ConsumerSignUp() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Your Account
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Start categorizing your bank transactions in minutes
          </p>
        </div>
        <ConsumerSignUpForm />
      </div>
    </div>
  );
}

