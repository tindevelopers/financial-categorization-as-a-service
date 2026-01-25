-- Identify transactions that were incorrectly created from invoice uploads
-- These should be documents for reconciliation, not transactions in statements

-- 1. Find all transactions linked to financial_documents (these shouldn't exist)
SELECT 
    ct.id,
    ct.original_description,
    ct.amount,
    ct.date,
    ct.created_at,
    ct.bank_account_id,
    ct.document_id,
    fd.original_filename,
    fd.vendor_name,
    fd.file_type,
    cj.job_type,
    cj.original_filename as job_filename
FROM categorized_transactions ct
LEFT JOIN financial_documents fd ON ct.document_id = fd.id
LEFT JOIN categorization_jobs cj ON ct.job_id = cj.id
WHERE ct.document_id IS NOT NULL
ORDER BY ct.created_at DESC;

-- 2. Find transactions with suspicious descriptions (Subtotal, Tax, VAT, dates, etc.)
SELECT 
    ct.id,
    ct.original_description,
    ct.amount,
    ct.date,
    ct.created_at,
    ct.bank_account_id,
    cj.job_type,
    cj.original_filename
FROM categorized_transactions ct
LEFT JOIN categorization_jobs cj ON ct.job_id = cj.id
WHERE 
    ct.original_description ILIKE '%subtotal%'
    OR ct.original_description ILIKE '%tax%'
    OR ct.original_description ILIKE '%vat%'
    OR ct.original_description ILIKE '%2025%'
    OR ct.original_description ILIKE '%2024%'
    OR ct.original_description ILIKE '% to %'
ORDER BY ct.created_at DESC;

-- 3. Find transactions from invoice/receipt jobs
SELECT 
    ct.id,
    ct.original_description,
    ct.amount,
    ct.date,
    ct.created_at,
    ct.bank_account_id,
    cj.job_type,
    cj.original_filename,
    cj.status
FROM categorized_transactions ct
INNER JOIN categorization_jobs cj ON ct.job_id = cj.id
WHERE 
    cj.job_type IN ('receipt', 'invoice', 'batch_receipt')
ORDER BY ct.created_at DESC;

-- 4. Count transactions by job type (to see the extent of the problem)
SELECT 
    cj.job_type,
    COUNT(ct.id) as transaction_count,
    SUM(ct.amount) as total_amount
FROM categorized_transactions ct
INNER JOIN categorization_jobs cj ON ct.job_id = cj.id
GROUP BY cj.job_type
ORDER BY transaction_count DESC;

-- 5. Find positive transactions that should probably be negative (invoices uploaded)
SELECT 
    ct.id,
    ct.original_description,
    ct.amount,
    ct.date,
    ct.created_at,
    ct.bank_account_id,
    fd.vendor_name,
    fd.total_amount as document_amount,
    cj.job_type
FROM categorized_transactions ct
LEFT JOIN financial_documents fd ON ct.document_id = fd.id
LEFT JOIN categorization_jobs cj ON ct.job_id = cj.id
WHERE 
    ct.document_id IS NOT NULL
    AND ct.amount > 0  -- Positive amounts (should be negative for payable invoices)
ORDER BY ct.created_at DESC;
