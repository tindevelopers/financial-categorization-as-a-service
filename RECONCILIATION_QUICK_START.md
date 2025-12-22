# Reconciliation Feature - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Apply Database Migration (2 minutes)

Open your Supabase SQL Editor and run:

```sql
-- Copy and paste the entire contents of:
-- RUN_THIS_TO_ENABLE_RECONCILIATION.sql
```

Or use the CLI:
```bash
supabase db push
```

### Step 2: Refresh Your Browser

The code is already deployed! Just refresh the page.

### Step 3: Navigate to Reconciliation

Go to: **`/dashboard/reconciliation`**

---

## 📸 What You'll See

### Main Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Reconciliation                    [✨ Auto-Match]          │
│  Match bank transactions with receipts and invoices         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 💰 12    │  │ ✅ 45    │  │ 📄 8     │                 │
│  │Unreconciled│ │ Matched  │  │Documents │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Unreconciled Transactions                                  │
├─────────────────────────────────────────────────────────────┤
│  Amazon Web Services                    Dec 15, 2025        │
│  £125.50                                                     │
│  Software & Subscriptions                                   │
│  [Show 3 potential match(es)]                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 AWS-Invoice-Dec.pdf        [HIGH]                │   │
│  │ £125.50  •  Dec 15  •  Diff: £0.00  •  0 days      │   │
│  │                                        [✅ Match]    │   │
│  │                                                      │   │
│  │ 📄 AWS-Receipt.pdf           [MEDIUM]               │   │
│  │ £125.00  •  Dec 14  •  Diff: £0.50  •  1 day       │   │
│  │                                        [✅ Match]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Tesco Superstore                       Dec 14, 2025        │
│  £45.20                                                      │
│  Food & Dining                                               │
│  [Show 1 potential match(es)]                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Usage Examples

### Example 1: Auto-Match Everything

1. Click **"Auto-Match"** button
2. See alert: "Successfully auto-matched 8 transaction(s)!"
3. Page refreshes automatically
4. Matched items disappear from list

**When to use:** You have many transactions with clear matches (same amount, close dates)

---

### Example 2: Manual Match

1. Find transaction: "Amazon Web Services - £125.50"
2. Click **"Show 3 potential match(es)"**
3. See matches with confidence badges:
   - 🟢 **HIGH**: AWS-Invoice-Dec.pdf (£125.50, same day)
   - 🟡 **MEDIUM**: AWS-Receipt.pdf (£125.00, 1 day apart)
   - ⚪ **LOW**: Amazon-Order.pdf (£120.00, 5 days apart)
4. Click **"Match"** on the HIGH confidence match
5. Transaction disappears from unreconciled list

**When to use:** You want to review matches before confirming

---

### Example 3: No Matches Found

If you see "No matching documents found":
- Upload the corresponding receipt/invoice
- Return to reconciliation page
- The match will appear automatically

---

## 🎨 Confidence Badge Guide

### 🟢 HIGH Confidence
- Amount difference: < £0.01 (basically exact)
- Date difference: ≤ 7 days
- **Recommendation**: Safe to auto-match

### 🟡 MEDIUM Confidence
- Amount difference: < £1.00
- Date difference: ≤ 30 days
- **Recommendation**: Review before matching

### ⚪ LOW Confidence
- Amount difference: < £100
- Date difference: ≤ 60 days
- **Recommendation**: Verify carefully before matching

---

## 💡 Pro Tips

### Tip 1: Upload in Batches
Upload all your bank statements first, then all your receipts. This gives the system more data to find matches.

### Tip 2: Use Auto-Match First
Let the system handle the obvious matches automatically, then manually review the rest.

### Tip 3: Check Date Ranges
If you don't see matches, check that your documents are within 60 days of your transactions.

### Tip 4: Amount Variations
The system accounts for small differences (like fees or rounding), so £125.50 can match £125.00.

---

## 🔧 API Usage (For Developers)

### Get Reconciliation Data
```typescript
const response = await fetch('/api/reconciliation/candidates')
const data = await response.json()

console.log(data.transactions) // Array of unreconciled transactions
console.log(data.summary) // { total_unreconciled, total_matched, total_documents }
```

### Auto-Match
```typescript
const response = await fetch('/api/reconciliation/auto-match', {
  method: 'POST'
})
const data = await response.json()

console.log(`Matched ${data.matched_count} transactions`)
console.log(data.matches) // Array of { transaction_id, document_id }
```

### Manual Match
```typescript
await fetch('/api/reconciliation/match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transaction_id: 'uuid-here',
    document_id: 'uuid-here'
  })
})
```

### Unmatch
```typescript
await fetch('/api/reconciliation/match?transaction_id=uuid-here', {
  method: 'DELETE'
})
```

---

## ❓ FAQ

**Q: What happens when I match a transaction?**  
A: Both the transaction and document are marked as "matched" and removed from the unreconciled list.

**Q: Can I undo a match?**  
A: Yes! Use the DELETE endpoint or we can add an "Unmatch" button in the UI.

**Q: Why don't I see any matches?**  
A: Make sure you have both transactions AND documents uploaded, and they have similar amounts and dates.

**Q: What if multiple documents match one transaction?**  
A: The system shows the top 5 matches. You choose which one to match.

**Q: Can I match one transaction to multiple documents?**  
A: Not in v1. This is a future enhancement for split transactions.

**Q: Does auto-match work for all transactions?**  
A: Only for high-confidence matches (80%+ score). Others require manual review.

---

## 🎉 You're Ready!

The reconciliation feature is fully functional and ready to use. Just:

1. ✅ Apply the migration
2. ✅ Refresh your browser  
3. ✅ Navigate to `/dashboard/reconciliation`
4. ✅ Start matching!

**Need help?** Check `RECONCILIATION_FEATURE.md` for detailed documentation.

---

**Happy Reconciling! 🎯**

