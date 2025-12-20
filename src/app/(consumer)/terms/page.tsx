import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | FinanceCategorizer",
  description: "Read the terms and conditions for using FinanceCategorizer's services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Terms of{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Service
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 md:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                By accessing or using FinanceCategorizer (&quot;the Service&quot;), you agree to be bound 
                by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, 
                you may not access or use the Service. We reserve the right to modify these 
                Terms at any time, and your continued use of the Service constitutes acceptance 
                of any modifications.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                2. Description of Service
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                FinanceCategorizer provides an AI-powered bank transaction categorization service. 
                Users can upload bank statements in CSV, XLS, or XLSX format, and our system 
                automatically categorizes transactions into predefined categories. The categorization 
                is provided as-is and users should review all categorizations for accuracy.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                3. Account Registration
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                To use certain features of the Service, you must register for an account. You agree 
                to provide accurate, current, and complete information during registration and to 
                update such information to keep it accurate and complete. You are responsible for 
                safeguarding your account credentials and for all activities that occur under your account.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                4. User Responsibilities
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
                <li>Only upload bank statements that you are authorized to access</li>
                <li>Not use the Service for any illegal or unauthorized purpose</li>
                <li>Not attempt to gain unauthorized access to the Service or its systems</li>
                <li>Not interfere with or disrupt the Service or servers</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                5. Intellectual Property
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                The Service and its original content, features, and functionality are owned by 
                FinanceCategorizer and are protected by international copyright, trademark, patent, 
                trade secret, and other intellectual property laws. You retain ownership of any 
                data you upload to the Service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                6. Subscription and Payment
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Certain features of the Service may require a paid subscription. By subscribing, 
                you agree to pay all applicable fees. Subscription fees are billed in advance on 
                a recurring basis. You may cancel your subscription at any time, but no refunds 
                will be provided for partial billing periods.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                7. Limitation of Liability
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT ANY WARRANTIES, 
                EXPRESS OR IMPLIED. IN NO EVENT SHALL FINANCECATEGORIZER BE LIABLE FOR ANY 
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT 
                OF OR RELATED TO YOUR USE OF THE SERVICE.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                8. Disclaimer
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                The transaction categorizations provided by the Service are generated by AI and 
                should not be considered as financial, tax, or legal advice. Users should always 
                review and verify categorizations before using them for any official purposes. 
                We do not guarantee 100% accuracy of categorizations.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                9. Privacy
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Your use of the Service is also governed by our{" "}
                <a href="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  Privacy Policy
                </a>
                , which is incorporated into these Terms by reference.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                10. Termination
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, 
                without prior notice or liability, for any reason, including if you breach these 
                Terms. Upon termination, your right to use the Service will immediately cease.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                11. Governing Law
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of 
                the jurisdiction in which FinanceCategorizer operates, without regard to its 
                conflict of law provisions.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                12. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:legal@financecategorizer.com" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  legal@financecategorizer.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

