# Gmail Integration Setup Guide

This guide explains how to set up Gmail integration to automatically receive invoices and receipts via email for reconciliation with bank statements.

## Overview

The Gmail integration allows each tenant to have a unique email address (e.g., `receipts-{tenant-id}@yourdomain.com`) that automatically:
1. Receives emails with invoice/receipt attachments
2. Extracts attachments (PDFs, images)
3. Processes them through OCR
4. Creates financial documents
5. Auto-categorizes and matches with bank transactions

## Prerequisites

1. Google Cloud Project with Gmail API enabled
2. Gmail account (service account or dedicated account)
3. Google Pub/Sub topic for push notifications
4. Domain configured for email forwarding (optional, for custom domain)

## Setup Steps

### 1. Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Library**
4. Search for "Gmail API" and enable it
5. Also enable **Google Cloud Pub/Sub API**

### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:3002/api/storage/drive/callback` (for local dev)
   - `https://yourdomain.com/api/storage/drive/callback` (for production)
5. Save the **Client ID** and **Client Secret**

### 3. Create Pub/Sub Topic

1. Go to **Pub/Sub** > **Topics**
2. Click **Create Topic**
3. Name it `gmail-notifications`
4. Note the full topic name: `projects/{project-id}/topics/gmail-notifications`

### 4. Set Up Gmail Account

You have two options:

#### Option A: Service Account (Recommended for Production)
- Create a service account in Google Cloud Console
- Grant it Gmail API access
- Use service account credentials

#### Option B: Dedicated Gmail Account
- Create a dedicated Gmail account (e.g., `receipts@yourdomain.com`)
- Complete OAuth flow to get access/refresh tokens
- Store tokens securely

### 5. Configure Environment Variables

Add to your `.env.local` or Vercel environment variables:

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/storage/drive/callback

# Gmail Service Account (if using service account)
GMAIL_ACCESS_TOKEN=your_access_token
GMAIL_REFRESH_TOKEN=your_refresh_token

# Gmail Pub/Sub
GMAIL_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-notifications
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Email Forwarding Domain
EMAIL_FORWARDING_DOMAIN=receipts.yourdomain.com

# App URL (for webhook callbacks)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 6. Set Up Email Forwarding Domain

If using a custom domain:

1. Configure DNS MX records for `receipts.yourdomain.com`
2. Point to your email service (Gmail, SendGrid, etc.)
3. Set up forwarding rules to forward emails to your Gmail account

Alternatively, use Gmail's native forwarding:
1. In Gmail, go to **Settings** > **Forwarding and POP/IMAP**
2. Add forwarding address: your Gmail account
3. Set up filters to forward emails matching tenant addresses

### 7. Initialize Gmail Watch

Once a tenant generates their forwarding address:

1. Call `POST /api/email/gmail/setup` to set up Gmail watch
2. This creates a push notification subscription
3. Gmail will send notifications to your Pub/Sub topic
4. Your webhook (`/api/email/gmail/webhook`) will receive notifications

### 8. Configure Pub/Sub Push Subscription

1. Go to **Pub/Sub** > **Subscriptions**
2. Create a new subscription for `gmail-notifications` topic
3. Set delivery type to **Push**
4. Set endpoint URL to: `https://yourdomain.com/api/email/gmail/webhook`
5. Set authentication to **Google Cloud IAM** or **OAuth 2.0**

## Usage Flow

1. **Tenant generates email address:**
   - User clicks "Generate Email Address" in reconciliation page
   - System creates unique address: `receipts-{tenant-id}@yourdomain.com`

2. **Email received:**
   - Vendor sends invoice to tenant's forwarding address
   - Email is forwarded to Gmail account
   - Gmail API detects new message
   - Push notification sent to Pub/Sub topic

3. **Webhook processes email:**
   - Pub/Sub delivers notification to `/api/email/gmail/webhook`
   - Webhook fetches message from Gmail API
   - Extracts attachments (PDFs, images)
   - Uploads to Supabase Storage
   - Creates `financial_documents` records

4. **OCR processing:**
   - Document is queued for OCR processing
   - Google Document AI extracts invoice data
   - Document is auto-categorized
   - Available for reconciliation

5. **Reconciliation:**
   - Document appears in reconciliation page
   - Auto-matched with bank transactions
   - User can manually match if needed

## API Endpoints

### Generate Forwarding Address
```
POST /api/email/forwarding-address
```
Generates a unique email address for the tenant.

### Get Forwarding Address
```
GET /api/email/forwarding-address
```
Returns tenant's active forwarding address and statistics.

### Set Up Gmail Watch
```
POST /api/email/gmail/setup
```
Initializes Gmail watch for push notifications.

### Gmail Webhook (Pub/Sub)
```
POST /api/email/gmail/webhook
```
Receives push notifications from Gmail via Pub/Sub.

## Troubleshooting

### Emails not being received
- Check Gmail watch expiration (renew if expired)
- Verify Pub/Sub subscription is active
- Check webhook logs for errors
- Verify forwarding address is active

### Attachments not processing
- Check file types (only PDFs and images supported)
- Verify Supabase Storage bucket permissions
- Check OCR processing logs

### Push notifications not working
- Verify Pub/Sub topic exists
- Check subscription endpoint URL
- Verify authentication credentials
- Check Gmail API quota limits

## Security Considerations

1. **Webhook Authentication:** Implement signature verification for Pub/Sub messages
2. **Token Storage:** Store Gmail OAuth tokens encrypted
3. **Rate Limiting:** Implement rate limiting on webhook endpoint
4. **Access Control:** Ensure tenant isolation in email processing
5. **Data Privacy:** Follow GDPR/privacy regulations for email content

## Monitoring

Monitor the following:
- Email receipt statistics (`GET /api/email/forwarding-address`)
- Gmail API quota usage
- Pub/Sub message delivery
- OCR processing success rate
- Document creation rate

## Next Steps

- Set up email templates for user notifications
- Implement email filtering rules
- Add support for multiple email addresses per tenant
- Add email forwarding statistics dashboard


