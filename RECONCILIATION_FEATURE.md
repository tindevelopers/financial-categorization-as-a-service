# Reconciliation Feature Implementation

## Overview

A complete reconciliation feature has been implemented that allows users to match bank transactions with uploaded receipts and invoices. The feature includes automatic matching algorithms and a user-friendly interface.

## Features Implemented

### 1. Database Schema
- ✅ Added reconciliation fields to `categorized_transactions` table
- ✅ Added reconciliation fields to `documents` table
- ✅ Created database functions for matching/unmatching
- ✅ Created reconciliation view for easy querying
- ✅ Added indexes for performance

**Migration File:** `supabase/migrations/20251221120000_add_reconciliation.sql`

### 2. API Endpoints

#### GET `/api/reconciliation/candidates`
- Fetches unreconciled transactions with potential document matches
- Returns match confidence scores (high/medium/low)
- Provides summary statistics
- Automatically finds top 5 matches per transaction

#### POST `/api/reconciliation/match`
- Manually match a transaction with a document
- Validates user ownership
- Updates both transaction and document status

#### DELETE `/api/reconciliation/match?transaction_id=xxx`
- Unmatch a previously matched transaction
- Restores both items to unreconciled status

#### POST `/api/reconciliation/auto-match`
- Automatically matches high-confidence pairs
- Uses intelligent scoring algorithm
- Only matches when confidence >= 80%
- Returns count of matched transactions

### 3. Matching Algorithm

The auto-match algorithm considers:
- **Amount Match (50% weight)**: Exact or near-exact amount matches
- **Date Proximity (30% weight)**: Transactions within 7 days
- **Description Match (20% weight)**: Vendor name similarity

**Confidence Levels:**
- **High**: Amount diff < £0.01 AND date diff <= 7 days
- **Medium**: Amount diff < £1.00 AND date diff <= 30 days
- **Low**: Amount diff < £100 AND date diff <= 60 days

### 4. User Interface

**Reconciliation Page** (`/dashboard/reconciliation`)

Features:
- Summary cards showing unreconciled, matched, and total documents
- Auto-match button for bulk processing
- Transaction list with expandable potential matches
- Match confidence badges (high/medium/low)
- One-click manual matching
- Amount and date difference display
- Dark mode support

## Database Schema Changes

### New Fields in `categorized_transactions`:
```sql
reconciliation_status TEXT DEFAULT 'unreconciled'
matched_document_id UUID
reconciled_at TIMESTAMP
reconciled_by UUID
reconciliation_notes TEXT
```

### New Fields in `documents`:
```sql
reconciliation_status TEXT DEFAULT 'unreconciled'
matched_transaction_id UUID
reconciled_at TIMESTAMP
reconciled_by UUID
```

### New Database Functions:
- `match_transaction_with_document(transaction_id, document_id)`
- `unmatch_transaction(transaction_id)`

### New View:
- `reconciliation_candidates` - Pre-calculated match candidates with scores

## Installation

### 1. Apply Database Migration

Run the migration in Supabase:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the SQL file
# Copy contents of supabase/migrations/20251221120000_add_reconciliation.sql
# and execute in Supabase SQL Editor
```

### 2. Verify Installation

The reconciliation page should now be accessible at:
- Main app: `https://your-domain.com/dashboard/reconciliation`
- Portal app: `https://your-domain.com/dashboard/reconciliation`

## Usage

### For End Users

1. **Upload Transactions**: Upload bank statements via the upload page
2. **Upload Documents**: Upload receipts/invoices via the invoice upload page
3. **Navigate to Reconciliation**: Go to `/dashboard/reconciliation`
4. **Auto-Match**: Click "Auto-Match" to automatically match high-confidence pairs
5. **Manual Match**: Expand any transaction to see potential matches and click "Match"
6. **Review**: Matched items are removed from the unreconciled list

### For Developers

#### Fetch Reconciliation Data
```typescript
const response = await fetch('/api/reconciliation/candidates')
const data = await response.json()
// data.transactions - array of unreconciled transactions with potential_matches
// data.summary - statistics
```

#### Match Transaction with Document
```typescript
const response = await fetch('/api/reconciliation/match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transaction_id: 'uuid',
    document_id: 'uuid'
  })
})
```

#### Auto-Match
```typescript
const response = await fetch('/api/reconciliation/auto-match', {
  method: 'POST'
})
const data = await response.json()
// data.matched_count - number of matches made
// data.matches - array of matched pairs
```

## Files Created/Modified

### New Files:
1. `supabase/migrations/20251221120000_add_reconciliation.sql`
2. `src/app/api/reconciliation/candidates/route.ts`
3. `src/app/api/reconciliation/match/route.ts`
4. `src/app/api/reconciliation/auto-match/route.ts`
5. `apps/portal/app/api/reconciliation/candidates/route.ts`
6. `apps/portal/app/api/reconciliation/match/route.ts`
7. `apps/portal/app/api/reconciliation/auto-match/route.ts`

### Modified Files:
1. `src/app/dashboard/reconciliation/page.tsx` (replaced placeholder)
2. `apps/portal/app/dashboard/reconciliation/page.tsx` (replaced placeholder)

## Testing

### Manual Testing Steps:

1. **Setup Test Data**:
   - Upload a bank statement with transactions
   - Upload invoices/receipts with matching amounts and dates

2. **Test Auto-Match**:
   - Navigate to reconciliation page
   - Click "Auto-Match" button
   - Verify matched count is displayed
   - Check that matched items disappear from unreconciled list

3. **Test Manual Match**:
   - Find a transaction with potential matches
   - Click "Show X potential match(es)"
   - Review match confidence and details
   - Click "Match" button
   - Verify transaction is removed from list

4. **Test Summary Cards**:
   - Verify unreconciled count decreases after matching
   - Verify matched count increases after matching
   - Verify document count is accurate

### API Testing:

```bash
# Get candidates (requires authentication)
curl -X GET https://your-domain.com/api/reconciliation/candidates

# Auto-match
curl -X POST https://your-domain.com/api/reconciliation/auto-match

# Manual match
curl -X POST https://your-domain.com/api/reconciliation/match \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"xxx","document_id":"yyy"}'

# Unmatch
curl -X DELETE https://your-domain.com/api/reconciliation/match?transaction_id=xxx
```

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Operations**: Select multiple transactions to match/unmatch
2. **Match Rules**: User-defined matching rules
3. **Reconciliation Reports**: Export reconciliation status
4. **Partial Matches**: Support for split transactions
5. **Machine Learning**: Improve matching with ML models
6. **Audit Trail**: Detailed history of reconciliation changes
7. **Notifications**: Alert users of new potential matches
8. **Filters**: Filter by date range, amount, status
9. **Search**: Search transactions and documents
10. **Undo**: Undo recent reconciliation actions

## Troubleshooting

### Migration Fails
- Check that `categorized_transactions` and `documents` tables exist
- Verify Supabase connection
- Check for conflicting column names

### No Matches Found
- Ensure both transactions and documents are uploaded
- Check that amounts and dates are within matching thresholds
- Verify reconciliation_status is 'unreconciled'

### API Errors
- Check authentication (user must be logged in)
- Verify RLS policies allow access
- Check browser console for detailed errors

## Performance Considerations

- Indexes are created on reconciliation_status fields
- Matching algorithm limits to 100 transactions per request
- Top 5 matches per transaction to avoid overwhelming UI
- Database functions use SECURITY DEFINER for efficiency

## Security

- All API endpoints require authentication
- RLS policies ensure users only see their own data
- Database functions validate user ownership
- No sensitive data exposed in match confidence scores

---

**Status**: ✅ Complete and Ready for Testing
**Version**: 1.0
**Date**: December 21, 2025

