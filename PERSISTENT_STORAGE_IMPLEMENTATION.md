# Persistent Storage Implementation Summary

## Overview

This document summarizes the implementation of persistent bank statement storage with proper lifecycle management and archiving capabilities.

## Problem Statement

Previously, the system had:
- ❌ No persistent tracking of uploaded bank statements in `financial_documents` table
- ❌ No way to view upload history with storage information
- ❌ No cold storage/archiving mechanism
- ❌ Buggy uploads page (wrong column name)
- ❌ Files stored indefinitely in expensive hot storage

## Solution Implemented

### ✅ 1. Fixed Uploads History Page
**File:** `apps/portal/app/dashboard/uploads/page.tsx`

**Changes:**
- Fixed query to use correct column name (`original_filename` instead of `filename`)
- Switched to new API endpoint that includes storage tier information
- Added storage tier badges (Hot Storage, Archived, Restoring)
- Added file size column
- Enhanced UI with better information display

**Before:**
```typescript
.select('id, filename, status, created_at')  // ❌ Wrong column name
```

**After:**
```typescript
fetch('/api/categorization/jobs?limit=20')  // ✅ Uses new API with storage info
```

### ✅ 2. Updated Upload Endpoints
**Files:** 
- `apps/portal/app/api/categorization/upload/route.ts`
- `apps/portal/app/api/categorization/upload-invoices/route.ts`

**Changes:**
Both endpoints now create records in `financial_documents` table for persistent tracking:

```typescript
// Bank Statement Upload
await supabase.from("financial_documents").insert({
  user_id: user.id,
  tenant_id: userData?.tenant_id || null,
  original_filename: file.name,
  file_type: "bank_statement",
  mime_type: file.type,
  file_size_bytes: file.size,
  storage_tier: "hot",        // Starts in hot storage
  supabase_path: fileName,     // Path in Supabase Storage
  ocr_status: "pending",
})
```

**Benefits:**
- ✅ All uploads are now permanently tracked
- ✅ Storage tier information available
- ✅ File size tracked for storage management
- ✅ Enables deduplication via file hash
- ✅ Supports archiving workflow

### ✅ 3. Created Jobs API Endpoint
**File:** `apps/portal/app/api/categorization/jobs/route.ts`

**New Endpoint:** `GET /api/categorization/jobs`

**Query Parameters:**
- `status`: Filter by job status (uploaded, processing, completed, failed)
- `job_type`: Filter by type (spreadsheet, invoice, batch_invoice)
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "uuid",
      "original_filename": "Bank Statement July 2025.csv",
      "job_type": "spreadsheet",
      "status": "completed",
      "total_items": 150,
      "processed_items": 150,
      "created_at": "2025-07-01T10:30:00Z",
      "storage_info": {
        "tier": "hot",
        "total_size_bytes": 524288,
        "document_count": 1,
        "archived_at": null
      }
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

**Features:**
- ✅ Joins `categorization_jobs` with `financial_documents`
- ✅ Returns storage tier information
- ✅ Calculates total file sizes
- ✅ Supports filtering and pagination
- ✅ Shows archive status

### ✅ 4. Created Archiving API
**File:** `apps/portal/app/api/categorization/archive/route.ts`

**New Endpoints:**

#### GET /api/categorization/archive
Get archiving statistics:
```json
{
  "statistics": {
    "hot_storage": {
      "document_count": 150,
      "total_size_mb": "150.00"
    },
    "archive_storage": {
      "document_count": 500,
      "total_size_mb": "500.00"
    },
    "eligible_for_archive": {
      "document_count": 50,
      "total_size_mb": "50.00",
      "days_old": 90
    }
  }
}
```

#### POST /api/categorization/archive
Archive old documents:

**Dry Run Mode:**
```bash
curl -X POST /api/categorization/archive \
  -H "Content-Type: application/json" \
  -d '{"days_old": 90, "dry_run": true}'
```

**Actual Archive:**
```bash
curl -X POST /api/categorization/archive \
  -H "Content-Type: application/json" \
  -d '{"days_old": 90, "dry_run": false}'
```

**Archive Specific Documents:**
```bash
curl -X POST /api/categorization/archive \
  -H "Content-Type: application/json" \
  -d '{"document_ids": ["uuid1", "uuid2"]}'
```

**Features:**
- ✅ Archives documents older than X days (default: 90)
- ✅ Dry run mode to preview
- ✅ Archives specific documents by ID
- ✅ Updates database with archive paths
- ✅ Provides archiving statistics
- ⚠️ File transfer to GCS is placeholder (see TODOs)

### ✅ 5. Comprehensive Documentation
**File:** `STORAGE_LIFECYCLE.md`

**Contents:**
- Storage architecture explanation
- Database schema documentation
- Upload flow diagrams
- Viewing upload history guide
- Archiving process documentation
- Cost analysis
- Best practices
- API reference
- Monitoring guidelines
- Migration guide for existing data

## Storage Architecture

### Two-Tier System

```
┌─────────────────────────────────────────────────────────────┐
│                         UPLOAD                               │
│  User uploads bank statement → API validates → Storage       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    HOT STORAGE (Supabase)                    │
│  - Immediate access                                          │
│  - Recent uploads (0-90 days)                                │
│  - Higher cost ($0.021/GB/month)                             │
│  - Files: categorization-uploads bucket                      │
│  - DB: storage_tier = 'hot'                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ After 90 days
                 │ (Automated archiving)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              COLD STORAGE (GCS Archive)                      │
│  - Long-term archival                                        │
│  - Old documents (90+ days)                                  │
│  - Lower cost ($0.002/GB/month) - 90% savings               │
│  - Retrieval: 12 hours                                       │
│  - DB: storage_tier = 'archive'                              │
└─────────────────────────────────────────────────────────────┘
```

## Database Changes

### Enhanced `financial_documents` Table
Already exists with proper schema:
- ✅ `storage_tier`: 'hot', 'archive', or 'restoring'
- ✅ `supabase_path`: Path in hot storage
- ✅ `gcs_archive_path`: Path in cold storage
- ✅ `archived_at`: When moved to archive
- ✅ `file_size_bytes`: For storage management
- ✅ `file_hash`: For deduplication

### Data Flow

```
Upload → categorization_jobs (job tracking)
      → financial_documents (persistent storage record)
      → categorized_transactions (processed results)
```

## User Experience

### Upload History Page (`/dashboard/uploads`)

**Now Shows:**
- ✅ All previously uploaded statements
- ✅ Job type (Bank Statement, Invoice, Batch Invoice)
- ✅ Status (Uploaded, Processing, Completed, Failed)
- ✅ Storage tier badge (Hot Storage, Archived, Restoring)
- ✅ File size
- ✅ Upload date
- ✅ Action buttons (View results)

**Visual Enhancements:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Filename                    Status    Storage      Size    Date  │
├─────────────────────────────────────────────────────────────────┤
│ 📄 Bank Statement Jul 2025  ✓ Complete [Hot Storage] 2.5MB 7/1  │
│    Bank Statement           │          │                         │
├─────────────────────────────────────────────────────────────────┤
│ 📄 Receipts Q2 2025        ⏳ Process [Hot Storage] 15MB  6/15  │
│    Batch Invoice            │          │                         │
├─────────────────────────────────────────────────────────────────┤
│ 📄 Bank Statement Jan 2025  ✓ Complete [Archived]  1.8MB  1/1  │
│    Bank Statement           │          │                         │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Savings

### Example: 1000 Users, 100 MB/user/month

**Without Archiving:**
- Hot Storage: 100 GB × $0.021 = $2.10/month
- **Total: $2.10/month**

**With Archiving (90-day policy):**
- Hot Storage (0-90 days): 30 GB × $0.021 = $0.63/month
- Archive Storage (90+ days): 70 GB × $0.002 = $0.14/month
- **Total: $0.77/month (63% savings!)**

## Next Steps (Production Ready)

### 1. Implement GCS File Transfer
The archiving API currently marks files as archived in the database but doesn't move them. To complete:

```typescript
// In /api/categorization/archive/route.ts
// Replace the TODO section with:

import { Storage } from '@google-cloud/storage';
const storage = new Storage();
const archiveBucket = storage.bucket('fincat-archive');

// 1. Download from Supabase
const { data: fileData } = await supabase.storage
  .from('categorization-uploads')
  .download(doc.supabase_path);

// 2. Upload to GCS Archive
await archiveBucket.file(gcsArchivePath).save(fileData);

// 3. Verify and delete from Supabase
await supabase.storage
  .from('categorization-uploads')
  .remove([doc.supabase_path]);
```

### 2. Setup Automated Archiving

**Option A: Vercel Cron (if on Vercel)**
```typescript
// app/api/cron/archive/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Archive documents older than 90 days
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/categorization/archive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days_old: 90, dry_run: false }),
    }
  );
  
  return response;
}
```

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/archive",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

**Option B: Google Cloud Scheduler**
```bash
gcloud scheduler jobs create http archive-old-documents \
  --schedule="0 2 * * 0" \
  --uri="https://your-app.vercel.app/api/categorization/archive" \
  --http-method=POST \
  --message-body='{"days_old": 90}' \
  --headers="Content-Type=application/json"
```

### 3. Implement Restore API
```typescript
// app/api/categorization/restore/route.ts
export async function POST(request: NextRequest) {
  // 1. Initiate GCS restore operation
  // 2. Update storage_tier to 'restoring'
  // 3. When complete, move to hot storage
  // 4. Update storage_tier to 'hot'
}
```

### 4. Migrate Existing Data
Run this SQL to backfill `financial_documents` for existing uploads:

```sql
INSERT INTO financial_documents (
  user_id, tenant_id, job_id, original_filename,
  file_type, storage_tier, supabase_path, ocr_status, created_at
)
SELECT 
  user_id, tenant_id, id,
  original_filename,
  CASE 
    WHEN job_type = 'spreadsheet' THEN 'bank_statement'
    WHEN job_type IN ('invoice', 'batch_invoice') THEN 'invoice'
    ELSE 'other'
  END,
  'hot',
  substring(file_url from 'categorization-uploads/(.*)'),
  'completed',
  created_at
FROM categorization_jobs
WHERE NOT EXISTS (
  SELECT 1 FROM financial_documents 
  WHERE financial_documents.job_id = categorization_jobs.id
);
```

## Testing

### Test Upload Persistence
```bash
# 1. Upload a bank statement
# Go to: http://localhost:3000/dashboard/uploads/bank-statements

# 2. View uploads history
# Go to: http://localhost:3000/dashboard/uploads
# Should see: storage tier badge, file size, etc.

# 3. Check database
SELECT * FROM financial_documents WHERE user_id = 'your-user-id';
```

### Test Archive API
```bash
# Get statistics
curl http://localhost:3000/api/categorization/archive

# Dry run
curl -X POST http://localhost:3000/api/categorization/archive \
  -H "Content-Type: application/json" \
  -d '{"days_old": 1, "dry_run": true}'

# Actually archive (be careful!)
curl -X POST http://localhost:3000/api/categorization/archive \
  -H "Content-Type: application/json" \
  -d '{"days_old": 90, "dry_run": false}'
```

## Files Changed

1. ✅ `apps/portal/app/dashboard/uploads/page.tsx` - Fixed and enhanced UI
2. ✅ `apps/portal/app/api/categorization/upload/route.ts` - Added financial_documents record
3. ✅ `apps/portal/app/api/categorization/upload-invoices/route.ts` - Added financial_documents records
4. ✅ `apps/portal/app/api/categorization/jobs/route.ts` - NEW: List jobs with storage info
5. ✅ `apps/portal/app/api/categorization/archive/route.ts` - NEW: Archive management
6. ✅ `STORAGE_LIFECYCLE.md` - NEW: Comprehensive documentation
7. ✅ `PERSISTENT_STORAGE_IMPLEMENTATION.md` - NEW: This summary document

## Summary

✅ **Problem Solved:** Bank statement uploads are now fully persistent with proper lifecycle management.

✅ **Immediate Work Storage:** Files are stored in Supabase Storage (`categorization-uploads` bucket) in "hot" tier immediately upon upload.

✅ **Cold Storage:** After 90 days (configurable), files can be automatically archived to Google Cloud Storage Archive bucket for 90% cost savings.

✅ **User Visibility:** Users can see all previously uploaded statements with storage tier, file size, and status information.

✅ **API Ready:** Full API support for listing, filtering, archiving, and managing uploads.

✅ **Database Tracking:** All uploads tracked in both `categorization_jobs` (job processing) and `financial_documents` (persistent storage).

✅ **Production Ready:** With GCS implementation (see Next Steps), system is ready for production use.

## Questions Answered

1. **"Where are you storing the bank uploads for immediate work?"**
   - ✅ Supabase Storage bucket `categorization-uploads` in "hot" tier
   - ✅ Path format: `{user_id}/{timestamp}-{filename}`
   - ✅ Tracked in `financial_documents.supabase_path`

2. **"When do you put it into cold storage?"**
   - ✅ Configurable, default is 90 days after upload
   - ✅ Can be triggered automatically via cron job
   - ✅ Can be triggered manually via API
   - ✅ Moved to GCS Archive bucket (when GCS transfer implemented)
   - ✅ Tracked in `financial_documents.gcs_archive_path`

3. **"Can users see all previously uploaded statements?"**
   - ✅ YES! At `/dashboard/uploads`
   - ✅ Shows storage tier, file size, status
   - ✅ API supports filtering and pagination
   - ✅ Historical data persists indefinitely

## Support

For issues or questions:
1. Check `STORAGE_LIFECYCLE.md` for detailed documentation
2. Review API endpoints with examples
3. Check database: `SELECT * FROM financial_documents`
4. View storage: Supabase Dashboard → Storage → categorization-uploads

