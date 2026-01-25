# Invoice/Receipt Processing Fix

## Problem

Invoice and receipt uploads were getting stuck showing "Processing is taking longer than expected" after 2 minutes.

### Root Cause

The background processing system uses Vercel's `waitUntil()` function which **only works in production**. In local development, the background job never actually executes, causing uploads to hang indefinitely.

## Changes Made

### 1. Fixed Background Processing for Local Development

**File:** `apps/portal/app/api/background/process-invoices/route.ts`

Added environment detection to run processing inline during development:

```typescript
// In development, waitUntil doesn't work properly, so we run inline
const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';

if (isProduction) {
  // Production: Use Vercel's waitUntil for true background processing
  waitUntil(
    processInvoicesBatch(jobId, user.id, supabase).catch((err) => {
      console.error("Background batch processing failed:", err);
    })
  );
} else {
  // Development: Run inline without waiting
  console.log(`[DEV MODE] Starting inline processing for job ${jobId}`);
  processInvoicesBatch(jobId, user.id, supabase).catch((err) => {
    console.error("Background batch processing failed:", err);
  });
}
```

### 2. Increased Frontend Polling Timeout

**File:** `apps/portal/app/dashboard/uploads/receipts/page.tsx`

- Increased `maxAttempts` from **120 seconds (2 min)** to **300 seconds (5 min)**
- Added intermediate warning message at 2 minutes: "Processing is taking longer than usual, but still running..."
- Improved final timeout message to be more informative

## Testing

### Local Development

1. **Start the dev server:**
   ```bash
   pnpm dev:portal
   ```

2. **Upload a test invoice/receipt:**
   - Navigate to "Invoices & Receipts" page
   - Upload a PDF or image file
   - Verify processing completes without timeout

3. **Check console output:**
   ```bash
   # You should see:
   [DEV MODE] Starting inline processing for job <jobId>
   ```

4. **Monitor logs:**
   ```bash
   tail -f apps/portal/.logs/server.log
   ```

### What to Expect

- **Local (Development):**
  - Processing starts immediately inline
  - Status updates appear in real-time
  - Completes faster (no background queue delay)
  - Console shows `[DEV MODE]` messages

- **Production (Vercel):**
  - Uses `waitUntil()` for true background processing
  - Status updates via polling
  - Processes asynchronously without blocking

## Additional Notes

### OCR Processing

The system uses Google Document AI for OCR processing. Make sure you have:

1. **Environment variables set:**
   - `GOOGLE_CREDENTIALS` (base64 encoded service account JSON)
   - Or credentials configured via Vercel KV/Blob storage

2. **Google Document AI API enabled:**
   - Invoice Parser processor
   - Proper IAM permissions

### Troubleshooting

**If processing still times out:**

1. Check if Google credentials are configured:
   ```bash
   # Check environment
   echo $GOOGLE_CREDENTIALS
   ```

2. Check server logs for OCR errors:
   ```bash
   tail -f apps/portal/.logs/server.log | grep -i "ocr\|google"
   ```

3. Verify Supabase connection:
   - Check `.env.local` has correct Supabase URL and keys
   - Ensure database tables exist

**If uploads fail immediately:**

1. Check profile is complete (company name required)
2. Verify bank account has default spreadsheet configured (if account selected)
3. Check file size (max 10MB per file)
4. Verify file type (JPG, PNG, PDF only)

## Future Improvements

1. **Add progress indicators** for OCR steps (downloading, processing, saving)
2. **Implement retry logic** for failed OCR attempts
3. **Add webhook support** for async status updates instead of polling
4. **Create worker queue** for local development (e.g., BullMQ)
5. **Add telemetry** for processing duration tracking

## Related Files

- `apps/portal/app/api/background/process-invoices/route.ts` - Background processor
- `apps/portal/app/api/categorization/upload-invoices/route.ts` - Upload endpoint
- `apps/portal/app/dashboard/uploads/receipts/page.tsx` - Frontend UI
- `apps/portal/lib/ocr/google-document-ai.ts` - OCR processing logic
