# Email Domain

Centralized email provider abstraction with primary/fallback routing, white-label support, and React Email templates.

## Features
- Provider registry with Amazon SES, Resend, and Inbucket (local) implementations.
- Primary/fallback selection from environment variables with health checks.
- Retry with exponential backoff and optional send logging.
- White-label support (custom domains, colors) using tenant branding.
- Template sending via React Email (optional, graceful fallback if not installed).

## Public API
Import only from the domain entrypoint:
```ts
import {
  sendEmail,
  sendBulkEmails,
  sendTemplateEmail,
  checkEmailHealth,
} from '@/core/email';
```

## Environment Variables
- `EMAIL_PROVIDER` — `ses` | `resend` | `inbucket`
- `EMAIL_FALLBACK_PROVIDER` — optional fallback provider
- Provider credentials:
  - SES: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Resend: `RESEND_API_KEY`
  - Inbucket (local): none required

## Usage
### Simple email
```ts
await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Welcome!',
  html: '<h1>Hello</h1>',
});
```

### Template email
```ts
import WelcomeEmail from '@/core/email/templates/auth/welcome';

await sendTemplateEmail(
  { to: 'user@example.com', from: 'noreply@yoursaas.com', subject: 'Welcome!' },
  WelcomeEmail,
  { userName: 'Jane Doe', tenantName: 'Acme Corp' }
);
```

### White-label
Pass `tenantId` and optional `customDomain`; branding/colors will be applied when present.
```ts
await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Welcome',
  html: '<p>Hi!</p>',
  tenantId: 'tenant-uuid',
  customDomain: 'tenant.acme.com',
});
```

## Health Check
```ts
const status = await checkEmailHealth();
// { healthy: boolean, primary?, fallback?, error? }
```

## Provider Configuration Helpers
```ts
import { getProviderConfigFromEnv, getFallbackProviderConfig } from '@/core/email';
```

## Testing
- Unit tests can mock providers by implementing the `EmailProvider` interface.
- React Email templates are optional; without `@react-email/render` installed, the service returns a placeholder HTML string and logs a warning.

## Notes
- This module is server-only; do not import in client components.
- Logging is currently console-based; can be extended to persist to `email_logs`.
# 📧 EMAIL DOMAIN

Central email service module for the SaaS platform.

## 📁 Structure

```
email/
├── index.ts                     # PUBLIC API - Import only from here!
├── email-interface.ts           # Provider-agnostic interface
├── email-service.ts             # Main email orchestrator
├── config/
│   ├── provider-config.ts      # Provider configuration
│   └── provider-factory.ts     # Provider instantiation
├── providers/
│   ├── resend-provider.ts      # Resend implementation
│   ├── amazon-ses-provider.ts  # Amazon SES implementation
│   └── inbucket-provider.ts    # Local testing (Supabase local)
└── templates/
    └── base/
        └── email-layout.tsx    # Base email template layout
```

## 🎯 Purpose

This domain handles:
- ✅ Transactional email sending (welcome, password reset, etc.)
- ✅ Template-based emails with React Email
- ✅ Multi-provider support with automatic fallback
- ✅ Retry logic with exponential backoff
- ✅ White-label email branding per tenant
- ✅ Email tracking (opens, clicks)
- ✅ Bulk email sending
- ✅ Health monitoring

## 📦 Public API

### Simple Email

```typescript
import { sendEmail } from '@/core/email';

await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Welcome to our platform',
  html: '<h1>Welcome!</h1><p>Thanks for joining.</p>',
  text: 'Welcome! Thanks for joining.',
});
```

### Template Email (React Email)

```typescript
import { sendTemplateEmail } from '@/core/email';
import WelcomeEmail from '@/core/email/templates/auth/welcome';

await sendTemplateEmail(
  {
    to: 'user@example.com',
    from: 'noreply@yoursaas.com',
    subject: 'Welcome to Acme Corp',
  },
  WelcomeEmail,
  {
    userName: 'John Doe',
    tenantName: 'Acme Corp',
    tenantLogo: 'https://acme.com/logo.png',
  }
);
```

### White-Label Email

```typescript
import { sendEmail } from '@/core/email';

// Email will automatically apply tenant's branding
await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>',
  tenantId: 'tenant-uuid',           // Loads tenant branding
  customDomain: 'tenant-domain.com',  // Uses custom domain
});
```

### Bulk Emails

```typescript
import { sendBulkEmails } from '@/core/email';

const emails = [
  { to: 'user1@example.com', from: 'noreply@yoursaas.com', subject: 'Hi', html: '...' },
  { to: 'user2@example.com', from: 'noreply@yoursaas.com', subject: 'Hi', html: '...' },
];

const results = await sendBulkEmails(emails);
```

### Health Check

```typescript
import { checkEmailHealth } from '@/core/email';

const health = await checkEmailHealth();
console.log(health);
// { healthy: true, primary: { ... }, fallback: { ... } }
```

## 🔌 Provider Support

### Currently Implemented:
- ✅ **Resend** - Modern transactional email API
- ✅ **Amazon SES** - AWS email service
- ✅ **Inbucket** - Local testing (included with Supabase local)

### Planned:
- 🔜 **SendGrid** - Enterprise email service
- 🔜 **Postmark** - Transactional email API
- 🔜 **Mailgun** - Email API service
- 🔜 **Brevo** (formerly Sendinblue) - Marketing + transactional

## ⚙️ Configuration

### Environment Variables

```env
# Primary Provider
EMAIL_PROVIDER=resend                     # resend | amazon_ses | inbucket
EMAIL_FROM_ADDRESS=noreply@yoursaas.com

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_SANDBOX=false

# Amazon SES
AWS_SES_ACCESS_KEY_ID=AKIAXXXXX
AWS_SES_SECRET_ACCESS_KEY=xxxxx
AWS_SES_REGION=us-east-1

# Inbucket (Local Development)
INBUCKET_URL=http://127.0.0.1:54324

# Fallback Provider (optional)
FALLBACK_EMAIL_PROVIDER=amazon_ses
```

### Local Development

For local development, use Inbucket (included with Supabase):

```env
EMAIL_PROVIDER=inbucket
INBUCKET_URL=http://127.0.0.1:54324
```

View emails at: http://127.0.0.1:54324

## 🎨 Email Templates

### Creating a Template

```typescript
// src/core/email/templates/auth/welcome.tsx
import { EmailTemplateProps } from '@/core/email';

interface WelcomeEmailProps extends EmailTemplateProps {
  userName: string;
  loginUrl: string;
}

export default function WelcomeEmail({ 
  userName, 
  loginUrl,
  tenantName,
  tenantLogo,
  primaryColor = '#3b82f6',
}: WelcomeEmailProps) {
  return (
    <html>
      <head>
        <style>{`
          body { 
            font-family: sans-serif;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
          }
          .button {
            background-color: ${primaryColor};
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          {tenantLogo && <img src={tenantLogo} alt={tenantName} />}
          <h1>Welcome, {userName}!</h1>
          <p>Thanks for joining {tenantName || 'our platform'}.</p>
          <a href={loginUrl} className="button">Get Started</a>
        </div>
      </body>
    </html>
  );
}
```

### Using the Template

```typescript
import { sendTemplateEmail } from '@/core/email';
import WelcomeEmail from '@/core/email/templates/auth/welcome';

await sendTemplateEmail(
  {
    to: 'user@example.com',
    from: 'noreply@yoursaas.com',
    subject: 'Welcome!',
  },
  WelcomeEmail,
  {
    userName: 'John',
    loginUrl: 'https://app.yoursaas.com/login',
    tenantName: 'Acme Corp',
  }
);
```

## 🔄 Features

### Automatic Retry

Failed emails are automatically retried with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay

Non-retryable errors (invalid email, unauthorized, etc.) are not retried.

### Automatic Fallback

If the primary provider fails, the system automatically switches to the fallback:

```env
EMAIL_PROVIDER=resend
FALLBACK_EMAIL_PROVIDER=amazon_ses
```

### White-Label Support

Emails automatically apply tenant branding when `tenantId` is provided:

```typescript
await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>',
  tenantId: 'tenant-uuid', // ✅ Loads tenant branding automatically
});
```

The system will:
1. Load tenant's branding (logo, colors, domain)
2. Replace sender domain with custom domain (if available)
3. Inject CSS variables for colors into HTML

### Email Logging

All sent emails are logged for audit and debugging:

```typescript
// Future: Logged to email_logs table
{
  messageId: 're_xxxxx',
  provider: 'resend',
  to: 'user@example.com',
  subject: 'Welcome',
  timestamp: '2025-01-01T00:00:00Z',
  success: true,
}
```

## 🔄 Dependencies

### This domain depends on:
- **Database**: Loading tenant white-label settings

### Other domains may depend on this for:
- **Auth**: Password reset emails, welcome emails
- **Billing**: Invoice emails, payment failure emails
- **Multi-Tenancy**: Tenant invitation emails
- **Notifications**: System notifications

## 🚀 Adding a New Provider

### 1. Create Provider Implementation

```typescript
// src/core/email/providers/sendgrid-provider.ts
import { 
  EmailProvider, 
  SendEmailParams, 
  SendEmailResult,
  ProviderCapabilities,
  HealthCheckResult,
} from '../email-interface';

export class SendGridProvider implements EmailProvider {
  readonly name = 'SendGrid';
  readonly type = 'sendgrid';
  
  readonly capabilities: ProviderCapabilities = {
    transactional: true,
    marketing: true,
    templates: true,
    bulkSend: true,
    scheduling: true,
    tracking: true,
    attachments: true,
    inlineImages: true,
    customHeaders: true,
  };
  
  private client: any;
  
  async initialize(config: ProviderConfig): Promise<void> {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(config.credentials.apiKey);
    this.client = sgMail;
  }
  
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const response = await this.client.send({
        to: params.to,
        from: params.from,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        provider: this.name,
        timestamp: new Date(),
        error: {
          code: error.code || 'SENDGRID_ERROR',
          message: error.message,
          statusCode: error.statusCode,
          details: error,
        },
      };
    }
  }
  
  async sendBulkEmails(emails: SendEmailParams[]): Promise<SendEmailResult[]> {
    // Implementation
  }
  
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // Verify API key is valid
      return {
        healthy: true,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.name,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### 2. Register Provider

```typescript
// src/core/email/config/provider-factory.ts
import { SendGridProvider } from '../providers/sendgrid-provider';

export async function createProvider(config: ProviderConfig): Promise<EmailProvider> {
  switch (config.type) {
    case 'sendgrid':
      provider = new SendGridProvider();
      break;
    // ... other providers
  }
  
  await provider.initialize(config);
  return provider;
}
```

### 3. Add Configuration

```typescript
// src/core/email/config/provider-config.ts
export function getProviderConfigFromEnv(providerType?: EmailProviderType): ProviderConfig | null {
  switch (type) {
    case 'sendgrid':
      return {
        type: 'sendgrid',
        credentials: {
          apiKey: process.env.SENDGRID_API_KEY,
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
        },
      };
    // ... other providers
  }
}
```

### 4. Update Interface

```typescript
// src/core/email/email-interface.ts
export type EmailProviderType = 
  | 'sendgrid' // ✅ Add new type
  | 'resend'
  | 'amazon_ses'
  // ... other types
```

## 🧪 Testing

### Test Email Sending

```typescript
import { sendEmail, checkEmailHealth } from '@/core/email';

// Check health
const health = await checkEmailHealth();
console.log('Email system healthy:', health.healthy);

// Send test email
const result = await sendEmail({
  to: 'test@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Test Email',
  html: '<p>This is a test</p>',
});

console.log('Email sent:', result.success);
console.log('Message ID:', result.messageId);
```

### Local Development with Inbucket

```bash
# Start Supabase (includes Inbucket)
supabase start

# View emails at: http://127.0.0.1:54324
```

All emails sent in local development will appear in Inbucket's web interface.

## 📊 Provider Comparison

| Provider | Transactional | Marketing | Templates | Bulk | Tracking | Price |
|----------|--------------|-----------|-----------|------|----------|-------|
| **Resend** | ✅ | ❌ | ✅ | ✅ | ✅ | $0.10/1k |
| **Amazon SES** | ✅ | ✅ | ❌ | ✅ | ✅ | $0.10/1k |
| **SendGrid** | ✅ | ✅ | ✅ | ✅ | ✅ | $19.95/mo |
| **Postmark** | ✅ | ❌ | ✅ | ✅ | ✅ | $15/mo |
| **Mailgun** | ✅ | ✅ | ✅ | ✅ | ✅ | $15/mo |
| **Inbucket** | ✅ | ❌ | ❌ | ✅ | ❌ | Free (local) |

## 🎓 Best Practices

### 1. Always Provide Text Alternative

```typescript
await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yoursaas.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>',
  text: 'Welcome!', // ✅ Always include plain text
});
```

### 2. Use Templates for Consistency

```typescript
// ✅ Good: Use template
await sendTemplateEmail(params, WelcomeEmail, props);

// ❌ Bad: Inline HTML everywhere
await sendEmail({ html: '<h1>...</h1>' });
```

### 3. Handle Errors Gracefully

```typescript
const result = await sendEmail(params);

if (!result.success) {
  console.error('Email failed:', result.error);
  // Show user-friendly error message
  // Log to monitoring system
  // Maybe retry later
}
```

### 4. Use Tenant Context for White-Label

```typescript
// ✅ Good: Automatic white-label
await sendEmail({
  ...params,
  tenantId: user.tenantId, // Applies tenant branding
});

// ❌ Bad: Manual branding
await sendEmail({
  ...params,
  html: `<div style="color: ${tenant.color}">...</div>`,
});
```

### 5. Test with Inbucket Locally

```env
# Local development
EMAIL_PROVIDER=inbucket
INBUCKET_URL=http://127.0.0.1:54324
```

Never use production email providers in development!

## 🔍 Troubleshooting

### Email Not Sending

1. **Check provider configuration**:
   ```typescript
   const health = await checkEmailHealth();
   console.log(health);
   ```

2. **Verify environment variables**:
   ```bash
   echo $EMAIL_PROVIDER
   echo $RESEND_API_KEY
   ```

3. **Check logs**:
   ```bash
   # Look for [Email Service] logs
   ```

### Emails Going to Spam

1. Set up SPF, DKIM, DMARC records for your domain
2. Use a reputable email provider (Resend, SendGrid)
3. Verify sender domain with provider
4. Include unsubscribe link
5. Avoid spam trigger words

### Provider API Errors

```typescript
const result = await sendEmail(params);

if (!result.success) {
  console.error('Error code:', result.error?.code);
  console.error('Error message:', result.error?.message);
  console.error('Status code:', result.error?.statusCode);
}
```

Common error codes:
- `INVALID_EMAIL`: Email address format is invalid
- `INVALID_SENDER`: Sender email not verified
- `DOMAIN_NOT_VERIFIED`: Domain not verified with provider
- `RATE_LIMIT_EXCEEDED`: Too many emails sent
- `UNAUTHORIZED`: Invalid API key
- `INSUFFICIENT_CREDITS`: Provider account out of credits

## 📚 Resources

### Email Providers
- [Resend](https://resend.com/docs)
- [Amazon SES](https://docs.aws.amazon.com/ses/)
- [SendGrid](https://docs.sendgrid.com/)
- [Postmark](https://postmarkapp.com/developer)
- [Mailgun](https://documentation.mailgun.com/)

### React Email
- [React Email](https://react.email/)
- [Email Templates](https://react.email/examples)

### Email Best Practices
- [Email Authentication (SPF, DKIM, DMARC)](https://www.cloudflare.com/learning/dns/dns-records/dns-dkim-record/)
- [Deliverability Guide](https://postmarkapp.com/guides/deliverability)
- [HTML Email Guide](https://www.campaignmonitor.com/dev-resources/guides/coding/)

---

**Need help?** Check the [Core README](../README.md) or [DEPENDENCIES.md](../../docs/DEPENDENCIES.md)
