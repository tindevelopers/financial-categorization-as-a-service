# Storage Lifecycle Management

## Overview

This document describes how bank statements and financial documents are stored, managed, and archived throughout their lifecycle in the Financial Categorization system.

## Storage Architecture

### Two-Tier Storage System

1. **Hot Storage (Supabase Storage)**
   - Immediate access for recent uploads
   - Fast retrieval for active processing
   - Located in `categorization-uploads` or `financial-documents` buckets
   - Default tier for all new uploads
   - Cost: Higher storage cost, instant access

2. **Cold Storage (Google Cloud Storage Archive)**
   - Long-term archival for old documents
   - Lower cost, slower retrieval
   - Documents older than 90 days (configurable)
   - Requires restoration request for access
   - Cost: ~1/10th of hot storage, 12-hour retrieval time

## Data Models

### Database Tables

#### 1. `categorization_jobs`
Tracks each upload/processing job:
- `id`: Unique job identifier
- `user_id`: Owner of the upload
- `job_type`: 'spreadsheet', 'invoice', or 'batch_invoice'
- `status`: 'uploaded', 'processing', 'completed', 'failed'
- `original_filename`: Original file name
- `file_url`: Supabase Storage URL (hot storage)
- `created_at`: Upload timestamp
- `completed_at`: Processing completion timestamp

#### 2. `financial_documents`
Persistent record of all financial documents:
- `id`: Unique document identifier
- `user_id`: Document owner
- `job_id`: Link to categorization job (if applicable)
- `original_filename`: Original file name
- `file_type`: 'bank_statement', 'invoice', 'receipt', etc.
- `file_size_bytes`: File size for storage management
- `file_hash`: SHA-256 hash for deduplication

**Storage Location Fields:**
- `storage_tier`: 'hot', 'archive', or 'restoring'
- `supabase_path`: Path in Supabase Storage (when in hot tier)
- `gcs_archive_path`: Path in GCS Archive (when archived)
- `archived_at`: Timestamp when moved to archive
- `restore_requested_at`: Timestamp when restoration requested

**OCR/Processing Fields:**
- `ocr_status`: 'pending', 'processing', 'completed', 'failed'
- `extracted_text`: Full text for search
- `extracted_data`: Structured JSON data

## Upload Flow

### Step 1: User Uploads File

```
User → Upload Page → POST /api/categorization/upload
```

1. File uploaded via drag-and-drop or file picker
2. Client-side validation (file type, size)
3. FormData sent to API endpoint

### Step 2: Server Processing

```typescript
// 1. Upload to Supabase Storage (Hot)
const fileName = `${user.id}/${Date.now()}-${file.name}`
await supabase.storage
  .from("categorization-uploads")
  .upload(fileName, fileBuffer)

// 2. Create categorization job
await supabase.from("categorization_jobs").insert({
  user_id: user.id,
  job_type: "spreadsheet",
  status: "uploaded",
  original_filename: file.name,
  file_url: publicUrl,
})

// 3. Create financial document record (PERSISTENT)
await supabase.from("financial_documents").insert({
  user_id: user.id,
  original_filename: file.name,
  file_type: "bank_statement",
  storage_tier: "hot",  // Starts in hot storage
  supabase_path: fileName,
  file_size_bytes: file.size,
  ocr_status: "pending",
})
```

### Step 3: File Processing

1. AI categorization runs
2. Transactions extracted and categorized
3. Results stored in `categorized_transactions`
4. Job status updated to 'completed'

## Viewing Upload History

### API Endpoint

**GET** `/api/categorization/jobs`

Query Parameters:
- `status`: Filter by status (uploaded, processing, completed, failed)
- `job_type`: Filter by type (spreadsheet, invoice, batch_invoice)
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Pagination offset

Response includes:
```json
{
  "success": true,
  "jobs": [
    {
      "id": "uuid",
      "original_filename": "Bank Statement July 2025.csv",
      "job_type": "spreadsheet",
      "status": "completed",
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

### UI Page

**Location:** `/dashboard/uploads`

Features:
- List of all uploaded statements
- Status badges (uploaded, processing, completed, failed)
- Storage tier badges (hot, archive, restoring)
- File size display
- Upload date
- Action buttons (View, Download)

## Archiving Process

### Automatic Archiving (Recommended)

Set up a cron job or scheduled task:

```typescript
// Example: Archive documents older than 90 days
POST /api/categorization/archive
{
  "days_old": 90,
  "dry_run": false
}
```

### Manual Archiving

Archive specific documents:

```typescript
POST /api/categorization/archive
{
  "document_ids": ["uuid1", "uuid2"],
  "dry_run": false
}
```

### Archive Statistics

Check what can be archived:

```typescript
GET /api/categorization/archive?days_old=90

Response:
{
  "statistics": {
    "hot_storage": {
      "document_count": 150,
      "total_size_bytes": 157286400,
      "total_size_mb": "150.00"
    },
    "archive_storage": {
      "document_count": 500,
      "total_size_bytes": 524288000,
      "total_size_mb": "500.00"
    },
    "eligible_for_archive": {
      "document_count": 50,
      "total_size_bytes": 52428800,
      "total_size_mb": "50.00",
      "days_old": 90
    }
  }
}
```

## Archiving Implementation

### Current Status (MVP)

✅ **Database Tracking:** Documents marked as archived in `financial_documents` table
✅ **Archive API:** Endpoint to archive old documents
✅ **Dry Run Mode:** Preview what will be archived
⚠️ **File Transfer:** Placeholder for GCS implementation

### Production Implementation TODO

To complete the archiving system:

1. **Setup GCS Archive Bucket**
   ```bash
   gcloud storage buckets create gs://fincat-archive \
     --location=us-central1 \
     --storage-class=ARCHIVE
   ```

2. **Implement File Transfer in Archive API**
   ```typescript
   // 1. Download from Supabase Storage
   const { data: fileData } = await supabase.storage
     .from('categorization-uploads')
     .download(doc.supabase_path);
   
   // 2. Upload to GCS Archive
   const { Storage } = require('@google-cloud/storage');
   const storage = new Storage();
   const bucket = storage.bucket('fincat-archive');
   await bucket.file(gcsArchivePath).save(fileData, {
     metadata: {
       contentType: doc.mime_type,
     }
   });
   
   // 3. Delete from Supabase (after verification)
   await supabase.storage
     .from('categorization-uploads')
     .remove([doc.supabase_path]);
   ```

3. **Implement Restoration API**
   ```typescript
   POST /api/categorization/restore
   {
     "document_ids": ["uuid"]
   }
   ```

4. **Setup Automated Archiving**
   - Vercel Cron Job (for Vercel deployments)
   - Or Google Cloud Scheduler
   - Run weekly: Archive documents older than 90 days

## Cost Analysis

### Storage Costs (Example: 1000 users, 100 MB/user/month)

**Without Archiving:**
- Total: 100 GB/month
- Supabase Storage: $0.021/GB/month
- Monthly Cost: **$2.10/month**

**With Archiving (after 90 days):**
- Hot Storage (0-90 days): 30 GB
- Archive Storage (90+ days): 70 GB
- Hot Cost: 30 GB × $0.021 = $0.63
- Archive Cost: 70 GB × $0.002 = $0.14
- Monthly Cost: **$0.77/month** (63% savings)

## Best Practices

### 1. Archive Old Documents
- Archive documents older than 90 days
- Run archiving weekly via cron job
- Monitor storage usage

### 2. Deduplication
- Use `file_hash` to detect duplicate uploads
- Show warning to user: "This file was already uploaded on [date]"
- Link to existing job instead of re-uploading

### 3. User Experience
- Show clear storage tier badges
- Indicate if document needs restoration
- Provide "restore" button for archived documents
- Show estimated restoration time (12 hours for GCS Archive)

### 4. Data Retention
- Keep `categorization_jobs` and `categorized_transactions` indefinitely
- Archive file storage, not database records
- Users can always view their transaction history
- Files can be restored on-demand

## API Reference

### Upload
- `POST /api/categorization/upload` - Upload bank statement
- `POST /api/categorization/upload-invoices` - Upload invoices

### List/View
- `GET /api/categorization/jobs` - List all jobs with storage info
- `GET /api/categorization/jobs/[jobId]` - Get specific job
- `GET /api/categorization/jobs/[jobId]/transactions` - Get transactions

### Archive Management
- `GET /api/categorization/archive` - Get archive statistics
- `POST /api/categorization/archive` - Archive old documents
- `POST /api/categorization/restore` - Restore archived documents (TODO)

## Monitoring

### Key Metrics to Track

1. **Storage Usage**
   - Hot storage size per user
   - Archive storage size per user
   - Total storage costs

2. **Archive Effectiveness**
   - Documents archived per week
   - Storage cost savings
   - Average document age before archival

3. **User Activity**
   - Restoration requests per month
   - Average time between upload and last access
   - Documents never accessed after processing

## Migration Guide

If you have existing uploads without `financial_documents` records:

```sql
-- Backfill financial_documents from categorization_jobs
INSERT INTO financial_documents (
  user_id,
  tenant_id,
  job_id,
  original_filename,
  file_type,
  storage_tier,
  supabase_path,
  ocr_status,
  created_at
)
SELECT 
  user_id,
  tenant_id,
  id as job_id,
  original_filename,
  CASE 
    WHEN job_type = 'spreadsheet' THEN 'bank_statement'
    WHEN job_type IN ('invoice', 'batch_invoice') THEN 'invoice'
    ELSE 'other'
  END as file_type,
  'hot' as storage_tier,
  substring(file_url from 'categorization-uploads/(.*)') as supabase_path,
  'completed' as ocr_status,
  created_at
FROM categorization_jobs
WHERE NOT EXISTS (
  SELECT 1 FROM financial_documents 
  WHERE financial_documents.job_id = categorization_jobs.id
);
```

## Support

For questions or issues with storage management:
1. Check archive statistics: `GET /api/categorization/archive`
2. Review file in database: `SELECT * FROM financial_documents WHERE id = 'uuid'`
3. Verify Supabase Storage: Check in Supabase Dashboard → Storage
4. Check logs for archiving errors

## Changelog

- **2025-12-21**: Initial storage lifecycle implementation
  - Added `financial_documents` table with storage tier tracking
  - Created archiving API endpoints
  - Updated UI to show storage information
  - Added comprehensive documentation

