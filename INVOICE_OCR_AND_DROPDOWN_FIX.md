# Invoice OCR and Dropdown Fix

## Issues Addressed

### 1. Year Values Being Parsed as Line Item Amounts
**Problem**: Invoice line items were showing "2025" (year from dates like "28 Jul 2025") as monetary amounts (£2,025.00).

**Root Cause**: The table parsing logic in `google-document-ai.ts` was not filtering out 4-digit year values when they appeared in table cells alongside actual amounts.

**Fix**: Added year detection in the table cell parsing logic:
- Check if a parsed number is a 4-digit year (1900-2099)
- Skip these values when assigning them to `total`, `unitPrice`, or `quantity`
- Prevents years from being treated as monetary amounts

### 2. Invoice/Receipt Dropdown Showing "No Documents Available"
**Problem**: After uploading invoices, the dropdown in the transaction edit modal showed "No documents available" even though the invoice was successfully processed.

**Root Causes**:
1. Query was filtering by `ocr_status = 'completed'` but documents might have different status values
2. No debugging/logging to help diagnose the issue

**Fixes**:
1. **Removed overly restrictive OCR status filter**: Changed from filtering by specific status values to accepting any document with a `total_amount`
2. **Added console logging**: Both server-side and client-side logging to help debug document loading
3. **Better error handling**: More detailed error messages in the frontend

## Files Changed

### 1. `/apps/portal/lib/ocr/google-document-ai.ts`
**Location**: Line 564-584 (table cell parsing)

**Changes**:
```typescript
// Added year detection in table parsing
const isYear = /^\s*\d{4}\s*$/.test(cellText) && amount >= 1900 && amount <= 2099;

// Skip year values when assigning amounts
if (!isYear) {
  // This is likely a monetary amount (not a year)
  if (total === undefined) {
    total = amount;
  }
  // ... rest of logic
}
```

Also added additional date pattern detection in `parseAmount` function to catch years in date contexts.

### 2. `/apps/portal/app/api/reconciliation/documents/route.ts`
**Location**: Query logic (lines 23-52)

**Changes**:
1. Removed restrictive `.in("ocr_status", ["completed", "processed", "ready"])` filter
2. Now accepts any document with `total_amount IS NOT NULL`
3. Added server-side console logging to track document fetching

```typescript
// OLD: Too restrictive
.eq("ocr_status", "completed")

// NEW: More permissive
.not("total_amount", "is", null)  // Any document with an amount
```

### 3. `/apps/portal/app/dashboard/statements/page.tsx`
**Location**: `loadAvailableDocuments` function

**Changes**:
- Added detailed client-side console logging
- Better error handling and error messages
- Logs document count and sample data for debugging

```typescript
console.log('[Statements] Loaded documents:', data.count, 'documents')
console.log('[Statements] Documents:', data.documents)
```

## Important Note

⚠️ **The OCR fix only applies to newly uploaded/processed invoices.** Existing invoices that were already processed with the old logic will still have incorrect line items. To fix existing invoices, you would need to:
1. Delete the old invoice
2. Re-upload and re-process it

The dropdown fix takes effect immediately and will show all existing documents.

## Testing Instructions

### Test 1: Upload New Invoice and Check OCR
1. Upload an invoice that contains dates with years (e.g., "28 Jul 2025 to 27 Aug")
2. Wait for processing to complete
3. Click "Review" button
4. **Expected**: Line items should NOT show year values (2025, 2024, etc.) as amounts
5. **Expected**: Only actual monetary amounts should be displayed

### Test 2: Check Dropdown Availability
1. Upload an invoice and wait for processing
2. Go to Statements page (All Transactions)
3. Click on any transaction to open edit modal
4. Scroll to "Match Invoice/Receipt" dropdown
5. **Expected**: Dropdown should list all uploaded invoices with vendor name, amount, and date
6. **Expected**: Should NOT show "No documents available" if invoices exist

### Test 3: Match Invoice to Transaction
1. Open transaction edit modal (from Test 2)
2. Select an invoice from the dropdown
3. Click "Match Invoice" button
4. **Expected**: Success message appears
5. **Expected**: Transaction is marked as matched
6. **Expected**: Matched invoice no longer appears in dropdown for other transactions

## Debugging

If issues persist, check browser console for:
- `[Statements] Loaded documents:` - Shows count of available documents
- `[reconciliation/documents] Found X documents` - Server-side log in Network tab

Check Network tab → `/api/reconciliation/documents` response to see:
- What documents are being returned
- Their `ocr_status`, `total_amount`, and other fields

## Related Issues Fixed Previously

- Invoice uploads no longer create transactions in `categorized_transactions` table
- Reconcile button now goes to Statements page (not empty Reconciliation page)
- Review button uses correct document ID (not job ID)
- Subtotal and tax are not created as separate line items
- Summary rows (Total, VAT, Subtotal) are filtered out of line items

## Date: January 25, 2025
