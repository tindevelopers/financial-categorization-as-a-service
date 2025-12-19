# Phase 1 Implementation - Financial Categorization MVP

## Overview

Phase 1 has been completed! This document outlines what was built and how to use it.

## What Was Built

### ✅ Database Schema
- **Migration**: `supabase/migrations/20251219020000_create_categorization_tables.sql`
  - `categorization_jobs` table - tracks upload and processing jobs
  - `categorized_transactions` table - stores categorized transactions
  - `user_category_mappings` table - stores user-defined category rules
  - RLS policies for data security
  - Indexes for performance

- **Storage Bucket**: `supabase/migrations/20251219020001_create_storage_bucket.sql`
  - Creates `categorization-uploads` bucket for temporary file storage
  - Storage policies for user file access

### ✅ Consumer UI (`apps/portal`)
- **Home Page** (`apps/portal/app/page.tsx`)
  - Attractive landing page with feature overview
  - Call-to-action to upload spreadsheet
  - "How It Works" section

- **Upload Page** (`apps/portal/app/upload/page.tsx`)
  - Clean, consumer-friendly upload interface
  - Drag & drop file upload
  - File validation and progress feedback

- **Review Page** (`apps/portal/app/review/[jobId]/page.tsx`)
  - Transaction review interface
  - Edit categories
  - Confirm transactions
  - Export to Google Sheets

### ✅ Components
- **SpreadsheetUpload** (`apps/portal/components/categorization/SpreadsheetUpload.tsx`)
  - File upload component using react-dropzone
  - Supports .xlsx, .xls, .csv files
  - File validation (type, size)
  - Upload progress indication

- **TransactionReview** (`apps/portal/components/categorization/TransactionReview.tsx`)
  - Displays categorized transactions in table
  - Edit category/subcategory inline
  - Confirm transactions
  - Export to Google Sheets button
  - Summary statistics

### ✅ API Routes
- **POST `/api/categorization/upload`**
  - Handles file upload
  - Validates file type and size
  - Uploads to Supabase Storage
  - Creates categorization job
  - Triggers processing

- **POST `/api/categorization/process`**
  - Parses spreadsheet (Excel/CSV)
  - Extracts transaction data
  - Auto-categorizes transactions
  - Saves to database

- **GET `/api/categorization/jobs/[jobId]/transactions`**
  - Retrieves transactions for a job
  - User authentication required

- **POST `/api/categorization/transactions/[id]/confirm`**
  - Confirms a transaction
  - Updates user_confirmed flag

- **PATCH `/api/categorization/transactions/[id]`**
  - Updates transaction category/subcategory
  - User can edit categories

- **POST `/api/categorization/jobs/[jobId]/export/google-sheets`**
  - Creates Google Sheet
  - Exports categorized transactions
  - Formats sheet with headers and colors
  - Returns shareable link

### ✅ Basic Categorization
- Rule-based categorization using keywords
- User-defined category mappings
- Confidence scoring
- Common categories:
  - Food & Dining (Groceries, Restaurants)
  - Transportation (Gas & Fuel, Other)
  - Shopping (General)
  - Utilities (General)
  - Uncategorized (default)

## Setup Instructions

### 1. Database Migrations

Run the migrations in Supabase:

```bash
# If using Supabase CLI locally
supabase db reset

# Or apply migrations manually in Supabase Studio
# Copy contents of:
# - supabase/migrations/20251219020000_create_categorization_tables.sql
# - supabase/migrations/20251219020001_create_storage_bucket.sql
```

### 2. Environment Variables

Add to `apps/portal/.env.local`:

```env
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Google Sheets API (for export)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create Service Account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "financial-categorization")
   - Grant "Editor" role (or create custom role with Sheets API access)
5. Create Key:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the JSON file
6. Extract credentials:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep the `\n` characters)

### 4. Install Dependencies

```bash
# Already installed, but if needed:
pnpm install --filter @tinadmin/portal
```

### 5. Run Development Server

```bash
# From project root
pnpm --filter @tinadmin/portal dev

# Or from apps/portal directory
cd apps/portal
pnpm dev
```

The portal will run on `http://localhost:3002`

## Usage Flow

1. **User visits** `http://localhost:3002`
2. **Clicks "Upload Spreadsheet"** → Goes to `/upload`
3. **Uploads file** → File validated and uploaded to Supabase Storage
4. **File processed** → Transactions extracted and categorized
5. **Redirected to review** → `/review/[jobId]`
6. **Reviews transactions** → Can edit categories, confirm transactions
7. **Exports to Google Sheets** → Creates formatted Google Sheet with all transactions

## File Format Requirements

Spreadsheets should have columns for:
- **Date** (column names: date, transaction_date, posted_date, date_posted, or first column)
- **Description** (column names: description, memo, details, transaction, merchant, payee, or second column)
- **Amount** (column names: amount, debit, credit, transaction_amount, or last column)

The parser is flexible and will try to auto-detect columns.

## Next Steps (Phase 2+)

- Invoice OCR integration
- Cloud storage integration (Dropbox/Google Drive)
- Async processing for large batches
- AI-powered categorization (Vercel AI Gateway)
- Chatbot integration (deferred)

## Testing

1. Create a test spreadsheet with sample transactions
2. Upload via `/upload` page
3. Verify transactions are extracted correctly
4. Check categorization accuracy
5. Test editing categories
6. Test Google Sheets export

## Notes

- Chatbot functionality is deferred (as requested)
- All categorization is currently rule-based (no AI yet)
- Processing is synchronous (async processing will be added in Phase 2)
- Files are stored temporarily in Supabase Storage (7-day retention recommended)
