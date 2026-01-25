# Cleanup Guide: Remove Incorrect Invoice Transactions

## Overview

This guide helps you identify and remove transactions that were incorrectly created from invoice uploads. These transactions should have been stored as documents for reconciliation, not as entries in your statements.

## What Gets Cleaned Up

The cleanup will remove:

1. **Transactions linked to financial_documents** (have `document_id` set)
   - These shouldn't exist - invoices should be documents, not transactions

2. **Transactions with suspicious descriptions**:
   - Contains "Subtotal", "Tax", "VAT"
   - Contains year values like "2025", "2024" (dates parsed as amounts)
   - Contains " to " (date ranges parsed incorrectly)

## Example of Bad Data

From your screenshot:
```
29 Jul 2025  |  XERO UK INV-24911881 - MILTON KEYNES  |  -£19.20  ← CORRECT (from statement)
29 Jul 2025  |  xero - Subtotal                       |  +£16.00  ← DELETE (from invoice)
27 Jul 2025  |  xero - Tax                            |  +£3.20   ← DELETE (from invoice)
27 Jul 2025  |  xero - The Great Western...2025       |  +£2025.00← DELETE (date as amount!)
```

After cleanup, only the bank statement transaction (-£19.20) will remain.

## Method 1: Using SQL (Database Access Required)

### Step 1: Identify Problems

Run this SQL to see what will be deleted:

```bash
psql YOUR_DATABASE_URL -f scripts/identify-invoice-transactions.sql
```

Or connect to your database and run the queries in:
`scripts/identify-invoice-transactions.sql`

### Step 2: Backup & Cleanup

```bash
psql YOUR_DATABASE_URL -f scripts/cleanup-invoice-transactions.sql
```

**IMPORTANT**: 
- Review the backup data before uncommenting the DELETE statements
- The script creates a backup table: `categorized_transactions_backup_invoice_cleanup`
- You can restore if something goes wrong

## Method 2: Using Admin API (Recommended)

### Step 1: Preview What Will Be Deleted

Make a request to the admin endpoint:

```bash
curl -X POST 'http://localhost:3000/api/admin/cleanup-invoice-transactions' \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

Or in your browser's developer console (while logged in):

```javascript
fetch('/api/admin/cleanup-invoice-transactions', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => console.log(data))
```

This will show:
- How many transactions will be deleted
- Total amount affected
- Breakdown by category (Subtotal, Tax, Date values, etc.)
- First 50 transactions for review

### Step 2: Execute Cleanup

Once you've reviewed and are ready to delete:

```bash
curl -X POST 'http://localhost:3000/api/admin/cleanup-invoice-transactions?execute=true' \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

Or in browser console:

```javascript
fetch('/api/admin/cleanup-invoice-transactions?execute=true', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Cleanup complete:', data);
    alert(`Deleted ${data.summary.total_transactions} transactions`);
  })
```

## Method 3: Using Database GUI (TablePlus, pgAdmin, etc.)

### Step 1: Run Identification Queries

Open your database in a GUI tool and run these queries:

```sql
-- See all transactions linked to financial documents
SELECT 
    id,
    original_description,
    amount,
    date,
    created_at
FROM categorized_transactions
WHERE document_id IS NOT NULL
ORDER BY created_at DESC;

-- See transactions with suspicious descriptions
SELECT 
    id,
    original_description,
    amount,
    date,
    created_at
FROM categorized_transactions
WHERE 
    original_description ILIKE '%subtotal%'
    OR original_description ILIKE '%tax%'
    OR original_description ILIKE '%vat%'
    OR original_description ILIKE '%2025%'
    OR original_description ILIKE '%2024%'
ORDER BY created_at DESC;
```

### Step 2: Create Backup

```sql
CREATE TABLE categorized_transactions_backup AS
SELECT * FROM categorized_transactions
WHERE document_id IS NOT NULL
   OR original_description ILIKE '%subtotal%'
   OR original_description ILIKE '%tax%'
   OR original_description ILIKE '%vat%'
   OR original_description ILIKE '%2025%'
   OR original_description ILIKE '%2024%';
```

### Step 3: Delete

```sql
DELETE FROM categorized_transactions
WHERE document_id IS NOT NULL;

DELETE FROM categorized_transactions
WHERE 
    original_description ILIKE '%subtotal%'
    OR original_description ILIKE '%tax%'
    OR original_description ILIKE '%vat%'
    OR original_description ILIKE '%2025%'
    OR original_description ILIKE '%2024%';
```

## What Happens After Cleanup?

### Transactions Removed ✅
- Subtotal entries
- Tax/VAT entries  
- Date values parsed as amounts
- Any other invoice-generated transactions

### Data Preserved ✅
- Bank statement transactions (the real transactions)
- Financial documents (invoices/receipts remain for matching)
- All other legitimate transactions

### What You Can Do Next ✅
1. **Re-upload invoices** - They won't create transactions anymore
2. **Auto-match** - Click "Auto-Match" on Reconciliation page
3. **Manual match** - Use the dropdown to match specific invoices
4. **Upload new statements** - Continue normal workflow

## Verification

After cleanup, verify the results:

```sql
-- Should return 0 (or very few legitimate cases)
SELECT COUNT(*) as invoice_transactions
FROM categorized_transactions
WHERE document_id IS NOT NULL;

-- Check statements page
-- Visit: http://localhost:3000/dashboard/statements
-- You should see only bank statement transactions

-- Check reconciliation page
-- Visit: http://localhost:3000/dashboard/reconciliation
-- Invoices should be available in the dropdown for matching
```

## Rollback (If Something Went Wrong)

If you used the SQL script method:

```sql
-- Restore from backup
INSERT INTO categorized_transactions
SELECT 
    id, user_id, tenant_id, job_id, original_description, amount, 
    date, category, subcategory, confidence_score, user_confirmed,
    created_at, updated_at, bank_account_id, invoice_number,
    supplier_id, document_id, reconciliation_status, matched_document_id,
    user_notes, source_type, source_identifier, is_breakdown_entry,
    breakdown_type, parent_transaction_id
FROM categorized_transactions_backup_invoice_cleanup
ON CONFLICT (id) DO NOTHING;
```

## Need Help?

If you encounter issues:

1. Check the backup table exists:
   ```sql
   SELECT COUNT(*) FROM categorized_transactions_backup_invoice_cleanup;
   ```

2. Check if financial_documents are still intact:
   ```sql
   SELECT COUNT(*) FROM financial_documents WHERE ocr_status = 'completed';
   ```

3. Review the server logs for any errors during cleanup

## Important Notes

⚠️ **Always backup before cleanup**
- The scripts create automatic backups
- You can also take a full database backup: `pg_dump YOUR_DATABASE > backup.sql`

✅ **This is safe**
- Only affects transactions incorrectly created from invoices
- Financial documents (invoices/receipts) remain intact
- Bank statement transactions are NOT affected
- You can rollback if needed

🔄 **Future uploads will work correctly**
- New invoice uploads won't create transactions
- They'll create documents for reconciliation only
- Auto-matching will work properly
- Manual matching dropdown will be available
