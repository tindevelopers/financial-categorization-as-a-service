-- BACKUP AND CLEANUP SCRIPT FOR INCORRECT INVOICE TRANSACTIONS
-- Run this script to remove transactions that were incorrectly created from invoice uploads

-- IMPORTANT: Review the data first using identify-invoice-transactions.sql
-- Make sure you have a database backup before running this!

-- ==============================================================================
-- STEP 1: CREATE BACKUP TABLE (SAFETY NET)
-- ==============================================================================

-- Create backup of transactions that will be deleted
CREATE TABLE IF NOT EXISTS categorized_transactions_backup_invoice_cleanup (
    LIKE categorized_transactions INCLUDING ALL
);

-- Add cleanup metadata
ALTER TABLE categorized_transactions_backup_invoice_cleanup 
ADD COLUMN IF NOT EXISTS backup_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS backup_reason TEXT DEFAULT 'Invoice transaction cleanup';

-- ==============================================================================
-- STEP 2: BACKUP TRANSACTIONS TO BE DELETED
-- ==============================================================================

-- Backup all transactions linked to financial_documents
INSERT INTO categorized_transactions_backup_invoice_cleanup
SELECT ct.*, NOW(), 'Transaction linked to financial_document (document_id IS NOT NULL)'
FROM categorized_transactions ct
WHERE ct.document_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backup transactions with suspicious descriptions
INSERT INTO categorized_transactions_backup_invoice_cleanup
SELECT ct.*, NOW(), 'Suspicious description (Subtotal/Tax/VAT/Date)'
FROM categorized_transactions ct
WHERE 
    (ct.original_description ILIKE '%subtotal%'
    OR ct.original_description ILIKE '%tax%'
    OR ct.original_description ILIKE '%vat%'
    OR ct.original_description ILIKE '%2025%'
    OR ct.original_description ILIKE '%2024%'
    OR ct.original_description ILIKE '% to %')
    AND ct.id NOT IN (SELECT id FROM categorized_transactions_backup_invoice_cleanup)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- STEP 3: REVIEW WHAT WILL BE DELETED
-- ==============================================================================

-- Review backup (THIS IS WHAT WILL BE DELETED)
SELECT 
    id,
    original_description,
    amount,
    date,
    created_at,
    backup_reason
FROM categorized_transactions_backup_invoice_cleanup
ORDER BY created_at DESC;

-- Count by backup reason
SELECT 
    backup_reason,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM categorized_transactions_backup_invoice_cleanup
GROUP BY backup_reason;

-- ==============================================================================
-- STEP 4: DELETE THE INCORRECT TRANSACTIONS
-- ==============================================================================

-- UNCOMMENT THE BELOW LINES TO ACTUALLY DELETE (AFTER REVIEWING THE BACKUP)

/*
-- Delete transactions linked to financial_documents
DELETE FROM categorized_transactions
WHERE document_id IS NOT NULL;

-- Delete transactions with suspicious descriptions
DELETE FROM categorized_transactions
WHERE 
    original_description ILIKE '%subtotal%'
    OR original_description ILIKE '%tax%'
    OR original_description ILIKE '%vat%'
    OR original_description ILIKE '%2025%'
    OR original_description ILIKE '%2024%'
    OR original_description ILIKE '% to %';

-- Verify deletion
SELECT 'Transactions deleted: ' || COUNT(*) 
FROM categorized_transactions_backup_invoice_cleanup
WHERE id NOT IN (SELECT id FROM categorized_transactions);
*/

-- ==============================================================================
-- STEP 5: RESTORE IF NEEDED (ROLLBACK)
-- ==============================================================================

-- If something went wrong, you can restore from backup:
/*
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
*/

-- ==============================================================================
-- NOTES
-- ==============================================================================

/*
This script identifies and removes transactions that were incorrectly created
from invoice uploads. These transactions should have been documents for 
reconciliation, not entries in the statements.

What gets deleted:
1. Transactions with document_id set (linked to financial_documents)
2. Transactions with descriptions containing:
   - Subtotal/Tax/VAT
   - Year values (2024, 2025)
   - Date range indicators (" to ")

All deleted transactions are backed up to:
  categorized_transactions_backup_invoice_cleanup

To restore if needed, uncomment the RESTORE section above.

After cleanup:
- Financial documents remain intact
- You can re-upload invoices (they won't create transactions)
- Auto-matching will work with existing bank statement transactions
- Manual matching dropdown will show available invoices
*/
