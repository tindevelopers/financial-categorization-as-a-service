import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | FinanceCategorizer",
  description: "Learn how FinanceCategorizer collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Privacy{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Policy
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
                1. Introduction
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                At FinanceCategorizer (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), we take your privacy seriously. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                information when you use our transaction categorization service. Please read this 
                privacy policy carefully.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                2. Information We Collect
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                <p><strong className="text-gray-900 dark:text-white">Personal Information:</strong> When you register for an account, we collect your email address and any other information you choose to provide.</p>
                <p><strong className="text-gray-900 dark:text-white">Financial Data:</strong> We process the bank statement files you upload to provide our categorization service. This may include transaction dates, descriptions, and amounts.</p>
                <p><strong className="text-gray-900 dark:text-white">Usage Data:</strong> We automatically collect certain information about your device and usage patterns, including IP address, browser type, and pages visited.</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
                <li>To provide and maintain our transaction categorization service</li>
                <li>To process and categorize your uploaded bank statements</li>
                <li>To communicate with you about your account and our services</li>
                <li>To improve our AI categorization algorithms</li>
                <li>To detect and prevent fraud or security issues</li>
                <li>To comply with legal obligations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                4. Data Security
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect 
                your personal information. This includes encryption of data in transit and at rest, 
                secure authentication mechanisms, and regular security audits. However, no method 
                of transmission over the Internet is 100% secure, and we cannot guarantee absolute 
                security.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                5. Data Retention
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                We retain your personal information for as long as your account is active or as 
                needed to provide you services. You can request deletion of your data at any time 
                by contacting us. Uploaded bank statements are automatically deleted after 
                processing is complete and results are delivered to you.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                6. Third-Party Services
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                We may use third-party services for hosting, analytics, and payment processing. 
                These services have their own privacy policies and we recommend you review them. 
                We do not sell your personal information to third parties.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                7. Your Rights
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                Depending on your location, you may have certain rights regarding your personal data, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
                <li>The right to access your personal information</li>
                <li>The right to correct inaccurate data</li>
                <li>The right to request deletion of your data</li>
                <li>The right to data portability</li>
                <li>The right to object to processing</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                8. Cookies
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                We use cookies and similar tracking technologies to enhance your experience on our 
                platform. You can control cookie settings through your browser preferences.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                9. Changes to This Policy
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any 
                changes by posting the new Privacy Policy on this page and updating the 
                &quot;Last updated&quot; date.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                10. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:privacy@financecategorizer.com" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  privacy@financecategorizer.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

