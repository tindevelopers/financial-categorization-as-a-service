/**
 * Base Email Layout
 * 
 * Shared layout for all email templates
 * Includes white-label support with tenant branding
 */

import * as React from 'react';

export interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
  tenantName?: string;
  tenantLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export default function EmailLayout({
  children,
  previewText,
  tenantName = 'SaaS Admin',
  tenantLogo,
  primaryColor = '#3b82f6',
  secondaryColor = '#10b981',
}: EmailLayoutProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {previewText && (
          <meta name="description" content={previewText} />
        )}
        <style>{`
          body {
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background-color: ${primaryColor};
            padding: 20px;
            text-align: center;
          }
          .logo {
            max-width: 150px;
            height: auto;
          }
          .content {
            padding: 40px 30px;
            color: #374151;
            line-height: 1.6;
          }
          .footer {
            padding: 20px 30px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: ${primaryColor};
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: ${secondaryColor};
          }
          h1, h2, h3 {
            color: #111827;
            margin-top: 0;
          }
          p {
            margin: 16px 0;
          }
          a {
            color: ${primaryColor};
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        `}</style>
      </head>
      <body>
        {/* Preview text (shown in email client preview) */}
        {previewText && (
          <div style={{ display: 'none', maxHeight: '0px', overflow: 'hidden' }}>
            {previewText}
          </div>
        )}
        
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0}>
          <tr>
            <td align="center" style={{ padding: '20px 0' }}>
              <table className="email-container" role="presentation" width="600" cellPadding="0" cellSpacing="0" border={0}>
                {/* Header */}
                <tr>
                  <td className="header">
                    {tenantLogo ? (
                      <img src={tenantLogo} alt={tenantName} className="logo" />
                    ) : (
                      <h2 style={{ color: '#ffffff', margin: 0 }}>{tenantName}</h2>
                    )}
                  </td>
                </tr>
                
                {/* Content */}
                <tr>
                  <td className="content">
                    {children}
                  </td>
                </tr>
                
                {/* Footer */}
                <tr>
                  <td className="footer">
                    <p>© {new Date().getFullYear()} {tenantName}. All rights reserved.</p>
                    <p>
                      This email was sent to you because you have an account with {tenantName}.
                    </p>
                    <p>
                      <a href="{{unsubscribe_url}}" style={{ color: '#6b7280' }}>Unsubscribe</a>
                      {' | '}
                      <a href="{{privacy_policy_url}}" style={{ color: '#6b7280' }}>Privacy Policy</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}




