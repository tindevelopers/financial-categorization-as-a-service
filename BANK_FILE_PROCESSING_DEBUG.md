# Bank File Processing Debug Guide

## Environment Variable Configuration

### Required for AI Categorization

To enable AI categorization for bank statement processing, ensure the following environment variables are set in Vercel:

```
USE_AI_CATEGORIZATION=true
AI_CATEGORIZATION_PROVIDER=vercel_ai_gateway
OPENAI_API_KEY=<your-openai-api-key>
```

**Note:** If `USE_AI_CATEGORIZATION` is not set to `"true"` (exact string match), the system will fall back to rule-based categorization.

### How to Verify in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Check if `USE_AI_CATEGORIZATION` is set to `true` (not `True`, `TRUE`, or `1`)
4. Verify `AI_CATEGORIZATION_PROVIDER` is set to `vercel_ai_gateway`
5. Ensure `OPENAI_API_KEY` is configured

## Debug Logging Added

Comprehensive logging has been added to track the entire bank file processing flow:

### 1. Background Processing (`apps/portal/app/api/background/process-spreadsheet/route.ts`)
- Job status updates (received → queued → processing → reviewing/failed)
- File download from Supabase Storage
- Processing results
- Error handling

### 2. Spreadsheet Processing (`apps/portal/lib/categorization/process-spreadsheet.ts`)
- AI categorization enablement check
- AI service initialization
- AI categorization batch processing
- Transaction extraction
- Merge service results

### 3. Transaction Insertion (`apps/portal/lib/sync/TransactionMergeService.ts`)
- Duplicate detection
- Batch insertion progress
- Insertion errors
- Final insertion counts

## Log Analysis

All logs are prefixed with `[DEBUG]` and will appear in Vercel function logs. Key log points:

1. **AI Categorization Check**: Look for `[DEBUG] AI categorization check` to see if AI is enabled
2. **File Download**: Look for `[DEBUG] File download result` to verify file retrieval
3. **Transaction Extraction**: Look for `[DEBUG] Transactions extracted` to see transaction count
4. **AI Processing**: Look for `[DEBUG] AI categorizeBatch completed` to verify AI categorization
5. **Transaction Insertion**: Look for `[DEBUG] Transaction batch inserted successfully` to verify database insertion

## Common Issues

1. **AI Not Enabled**: Check `USE_AI_CATEGORIZATION` env var is exactly `"true"`
2. **File Download Fails**: Check file path construction matches upload path
3. **No Transactions Extracted**: Check spreadsheet format matches expected columns
4. **Insertion Fails**: Check RLS policies allow insertion for the user
5. **Job Stuck**: Check job status transitions in logs

