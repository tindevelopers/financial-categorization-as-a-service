# Invoice Processing and Reconciliation Fixes

## Summary
Fixed critical invoice processing workflow - invoices now properly create documents for reconciliation instead of creating duplicate transactions.

## Critical Fix: Invoice Processing Flow

### The Problem
When uploading invoices/receipts, the system was incorrectly creating transactions in the statements table. This caused:
1. ❌ Duplicate entries - transactions appeared twice (once from bank statement, once from invoice)
2. ❌ Wrong transaction direction - showing as money in instead of money out
3. ❌ Separated line items - subtotal, tax, and dates appearing as separate transactions
4. ❌ Date values parsed as amounts - "2025" from "28 Jul 2025" created £2,025.00 transactions

### The Solution
Invoices/receipts now work correctly:
1. ✅ **No transactions created** - invoices only create document records
2. ✅ **Stored for matching** - invoice data saved in `financial_documents` table
3. ✅ **Auto-matching works** - system matches invoices to existing bank transactions
4. ✅ **Manual matching available** - dropdown to manually select invoices for matching

## Correct Workflow

### Bank Statement Upload
```
User uploads bank statement → System creates transactions in categorized_transactions
```

**Result**: Transactions visible in Statements page (e.g., -£19.20 XERO UK INV-24911881)

### Invoice/Receipt Upload
```
User uploads invoice → System extracts data via OCR → Stores in financial_documents table
```

**Result**: Document available for matching (NOT visible in Statements page until matched)

### Reconciliation
```
System auto-matches OR user manually matches → Links document to transaction
```

**Result**: Transaction shows matched icon with attached document

## Files Changed

### Invoice Processing (Removed Transaction Creation)
- `apps/portal/app/api/background/process-invoices/route.ts`
  - Lines 375-407: Removed transaction creation logic
  - Line 380: Added auto-reconciliation call
  - Lines 969-971: Fixed amount comparison to use absolute values
  - Line 962: Removed filter for just-created transactions

- `apps/portal/app/api/categorization/process-invoices/route.ts`
  - Lines 122-148: Removed transaction creation logic
  - Lines 483, 520: Fixed amount comparison to use absolute values
  - Line 476: Removed filter for just-created transactions

### OCR Improvements (Prevent Bad Data Extraction)
- `apps/portal/lib/ocr/google-document-ai.ts`
  - Lines 1752-1761: Enhanced date filtering (added "to 27 Aug", "Jul 2025", etc.)
  - Lines 496-503, 592-600: Filter out summary rows (Subtotal, Tax, VAT, etc.)

### Reconciliation Matching (Fixed Amount Comparison)
- `apps/portal/app/api/reconciliation/candidates/route.ts`
  - Lines 180-206: Use absolute values for amount comparison

- `apps/portal/app/api/reconciliation/auto-match/route.ts`
  - Lines 73-84: Use absolute values for amount comparison

- `apps/portal/app/api/reconciliation/unreconciled/route.ts`
  - Line 161: Use absolute values for amount comparison

### Manual Matching UI
- `apps/portal/app/dashboard/reconciliation/page.tsx`
  - Added dropdown selector to manually choose invoices/receipts
  - Added state for available documents
  - Added `loadAvailableDocuments()` function

- `apps/portal/app/api/reconciliation/documents/route.ts` (new)
  - Returns all processed invoices/receipts for manual selection

## Why Absolute Value Comparison?

**Bank Transactions**: Money out (expenses) = negative amount (e.g., -£19.20)
**Invoice Documents**: Always stored as positive amount (e.g., £19.20)

To match them, we compare absolute values:
```typescript
// Before (WRONG - would never match)
const amountDiff = Math.abs((tx.amount || 0) - (doc.total_amount || 0));
// tx.amount = -19.20, doc.total_amount = 19.20
// amountDiff = Math.abs(-19.20 - 19.20) = 38.40 ❌

// After (CORRECT - matches)
const txAmount = Math.abs(tx.amount || 0);
const docAmount = Math.abs(doc.total_amount || 0);
const amountDiff = Math.abs(txAmount - docAmount);
// txAmount = 19.20, docAmount = 19.20
// amountDiff = Math.abs(19.20 - 19.20) = 0.00 ✅
```

## Testing

### Test 1: Upload New Invoice
1. Go to **Invoices & Receipts** page
2. Upload an invoice (e.g., the Xero invoice)
3. Wait for OCR processing to complete
4. Go to **Statements** page
5. ✅ **Verify**: Invoice should NOT appear as a transaction
6. Go to **Reconciliation** page
7. ✅ **Verify**: Invoice appears in dropdown for manual matching
8. ✅ **Verify**: If transaction exists with matching amount/date, it shows as potential match

### Test 2: Auto-Matching
1. Upload a bank statement with transaction: `-£19.20` on `29 Jul 2025` for `XERO UK INV-24911881`
2. Upload the corresponding Xero invoice: `£19.20` dated `27 Jul 2025`
3. Go to **Reconciliation** page
4. Click **Auto-Match** button
5. ✅ **Verify**: Transaction and invoice are automatically matched
6. ✅ **Verify**: Breakdown modal shows correct subtotal and tax

### Test 3: Manual Matching
1. Go to **Reconciliation** page
2. Expand an unmatched transaction
3. Use the **"Select Invoice/Receipt"** dropdown
4. Choose a document to match
5. ✅ **Verify**: Breakdown modal opens with invoice details
6. ✅ **Verify**: Amounts match (absolute values compared)
7. Confirm the match
8. ✅ **Verify**: Transaction shows as matched with document attached

### Test 4: Existing Bad Data
The existing incorrect transactions (like the separate subtotal/tax/date entries) will remain in your statements. You can either:
- **Delete them manually** (if the Statements page has delete functionality)
- **Re-upload the invoice** after clearing the old data
- **Keep them** - they won't interfere with new uploads

## Database State

### financial_documents Table
Invoice data is stored here:
- `vendor_name` - Extracted vendor name
- `total_amount` - Total invoice amount (positive)
- `subtotal_amount` - Subtotal before tax
- `tax_amount` - VAT/tax amount
- `fee_amount` - Additional fees
- `line_items` - JSON array of line items
- `document_date` - Invoice date
- `ocr_status` - Processing status
- `reconciliation_status` - Match status

### categorized_transactions Table
Bank statement transactions:
- Created from bank statement uploads only
- Negative amounts for expenses (money out)
- Positive amounts for income (money in)
- `matched_document_id` - Links to financial_documents when matched

### No More Duplicate Data
Previously:
- Invoice upload → Created transactions (wrong!)
- Bank statement upload → Created transactions
- Result: Duplicate entries

Now:
- Invoice upload → Creates document record only
- Bank statement upload → Creates transactions
- Reconciliation → Links them together

## API Endpoints

### Modified Endpoints
- **POST** `/api/categorization/upload-invoices`
  - No longer creates transactions
  - Only creates financial_documents records

- **POST** `/api/background/process-invoices`
  - Extracts OCR data
  - Stores in financial_documents
  - Attempts auto-reconciliation with existing transactions
  - Does NOT create new transactions

### New Endpoint
- **GET** `/api/reconciliation/documents`
  - Returns all available invoices/receipts
  - Filters: `ocr_status = 'completed'`, `total_amount IS NOT NULL`
  - Used by manual matching dropdown

## Notes

### Why This is Better
1. **Single Source of Truth**: Transactions only come from bank statements
2. **No Duplicates**: Invoices don't create competing transaction records
3. **Proper Reconciliation**: System matches documents to existing transactions
4. **Audit Trail**: Can see which documents support which transactions
5. **Tax Breakdown**: Can extract and store subtotal/tax separately without cluttering statements

### What About Old Data?
The changes only affect new invoice uploads. Existing incorrect transactions remain in the database. Options:
1. Manually delete incorrect transactions from Statements page
2. Contact support for bulk data cleanup
3. Leave them - they won't interfere with new uploads

### Invoice vs Receipt
Both work the same way:
- **Receipt**: Proof of payment already made
- **Invoice**: Bill to be paid

Both are stored as documents and matched to bank transactions, not created as transactions themselves.

## Future Enhancements

Potential improvements:
1. Add bulk delete for incorrect transactions
2. Add "reprocess invoice" button to fix old data
3. Add invoice preview in matching modal
4. Add filters to document dropdown (by vendor, date, amount range)
5. Add confidence score display in manual matching
6. Add document search/autocomplete for large libraries
