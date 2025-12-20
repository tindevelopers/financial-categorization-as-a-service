# Week 1 Testing Guide

## Pre-requisites

1. **Supabase Migration Applied**
   - Go to Supabase Dashboard → SQL Editor
   - Run: `apps/portal/supabase/migrations/20251221000000_company_profiles.sql`
   - OR copy content from that file and execute

2. **Environment Variables Set in Vercel**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Testing Steps

### Step 1: Landing Page
- URL: `/`
- **Not signed in**: Should see marketing page
- **Signed in**: Should redirect to `/dashboard`

### Step 2: Sign In
- URL: `/signin`
- Enter credentials
- Should redirect to `/dashboard/setup` (if no company)

### Step 3: Company Setup Wizard
- URL: `/dashboard/setup`
- **Step 1**: Enter company name, select type
  - Should see Catalyst Input and Select components
- **Step 2**: Toggle VAT registered, select scheme
  - Should see Catalyst Switch and Radio components
- **Step 3**: Add bank accounts (optional)
  - Should see Add/Remove buttons
- **Step 4**: Review details
  - Should see summary with DescriptionList
- Click "Complete Setup"
  - Should create company in database
  - Should redirect to `/dashboard`

### Step 4: Dashboard (Finally!)
- URL: `/dashboard`
- **Should see:**
  - ✅ Sidebar on left with navigation items
  - ✅ Top navbar with company switcher and user menu
  - ✅ Metric cards (Uploads, Transactions, Matched, Unmatched)
  - ✅ Quick action cards
  - ✅ Recent activity section

### Step 5: Navigation Test
- Click sidebar items:
  - Dashboard → `/dashboard`
  - Company Setup → `/dashboard/setup`
  - Reconciliation → `/dashboard/reconciliation` (will be 404 for now)
  - Uploads → `/dashboard/uploads` (will be 404 for now)

---

## Common Issues

### Issue 1: Blank Page at `/dashboard`
**Cause**: Middleware redirecting because no company setup
**Fix**: Complete `/dashboard/setup` wizard first

### Issue 2: "companies table doesn't exist"
**Cause**: Migration not run on preview database
**Fix**: Run migration in Supabase Dashboard SQL Editor

### Issue 3: Catalyst components not rendering
**Cause**: Missing @headlessui/react or import errors
**Fix**: Check browser console for module errors

### Issue 4: Infinite redirect loop
**Cause**: Middleware logic issue or RLS policy blocking company query
**Fix**: Check browser Network tab for failing requests

---

## Debugging Commands

### Check if user has company:
```sql
SELECT c.* 
FROM companies c
JOIN auth.users u ON c.user_id = u.id
WHERE u.email = 'your-email@example.com';
```

### Create test company manually:
```sql
INSERT INTO companies (
  user_id, 
  company_name, 
  company_type, 
  setup_completed
) VALUES (
  'your-user-id-here',
  'Test Company',
  'sole_trader',
  true
);
```

---

## Expected File Structure

```
apps/portal/app/dashboard/
  ├── layout.tsx         ← Dashboard layout with sidebar
  ├── page.tsx           ← Dashboard home
  └── setup/
      └── page.tsx       ← Setup wizard

apps/portal/components/
  ├── catalyst/          ← 28 UI components
  │   ├── sidebar-layout.tsx
  │   ├── sidebar.tsx
  │   ├── button.tsx
  │   └── ...
  ├── navigation/
  │   ├── CompanySwitcher.tsx
  │   └── UserMenu.tsx
  └── setup/
      ├── CompanyDetailsForm.tsx
      ├── TaxSettingsForm.tsx
      ├── BankAccountsForm.tsx
      └── CompletionStep.tsx
```

---

## What to Screenshot/Share

If still not working, please share:
1. Current URL
2. Browser console errors (F12 → Console tab)
3. Network tab showing failed requests
4. What you see on the screen

