import SignupWizard from "@/components/auth/SignupWizard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Choose Your Plan",
  description: "Sign up and choose the plan that best fits your needs - Individual, Company, or Enterprise",
};

export default function SignUp() {
  return <SignupWizard />;
}
