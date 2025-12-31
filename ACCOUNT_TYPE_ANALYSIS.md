# Account Type Analysis & Fixes

## Problem Summary

An individual account is incorrectly requesting BYO (Bring Your Own) credentials, which should only be available for enterprise/business accounts.

## Root Cause

1. **Account Type Fields**: The system uses two fields to determine account type:
   - `subscription_type` in `tenants` table: `"individual" | "company" | "enterprise"`
   - `tenant_type` in `tenants` table: `"individual" | "company"`

2. **Tier Logic Issue**: In `apps/portal/lib/google-sheets/tier-config.ts`:
   - If `entityType === "individual"`, tier should be `"consumer"`
   - BUT if `googleIntegrationTier` is explicitly set to `"enterprise_byo"` in settings, it overrides this
   - When tier is `"enterprise_byo"`, it requires `dwdSubjectEmail` which is missing for individual accounts

3. **Display Issue**: Account types are not clearly displayed in:
   - Admin Panel (`apps/admin/app/saas/admin/entity/tenant-management/page.tsx`)
   - Account Panel (user settings/profile pages)

## Why Individual Accounts Are Asking for BYO

The tenant likely has:
- `tenant_type = "individual"` OR `subscription_type = "individual"`
- BUT `use_custom_credentials = true` OR `googleIntegrationTier = "enterprise_byo"` is set in `tenant_integration_settings`
- This causes the system to try to use enterprise BYO mode, which requires `dwdSubjectEmail`

## Solution Implemented

### ✅ 1. Fixed Tier Configuration Logic
**File**: `apps/portal/lib/google-sheets/tier-config.ts`
**Change**: Individual accounts now CANNOT use enterprise_byo tier, even if explicitly set. The check for `entityType === "individual"` now happens BEFORE checking for explicit tier override.

**Before**:
```typescript
if (explicitTier) {
  tier = explicitTier;  // Could override individual to enterprise_byo
} else if (entityType === "individual") {
  tier = "consumer";
}
```

**After**:
```typescript
// CRITICAL: Individual accounts CANNOT use enterprise_byo tier
if (entityType === "individual") {
  tier = "consumer";  // Always consumer for individual accounts
} else if (explicitTier) {
  tier = explicitTier;  // Only allow override for company/enterprise
}
```

### ✅ 2. Added Account Type Display in Admin Panel
**File**: `apps/admin/app/saas/admin/entity/tenant-management/page.tsx`
**Change**: Added account type badge showing `subscription_type` or `tenant_type` next to user count and region.

**Display**: Shows "Account: individual", "Account: company", or "Account: enterprise" as a purple badge.

### ✅ 3. Improved Error Messages
**File**: `apps/portal/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts`
**Change**: Error messages now detect if the account is individual and provide specific guidance.

**New Error Message for Individual Accounts**:
```
"Individual accounts cannot use Enterprise BYO credentials. Please connect your Google account in Settings > Integrations > Google Sheets instead."
```

**Error Code**: `INDIVIDUAL_ACCOUNT_BYO_ERROR` (new error code for this specific case)

## How to Verify Account Type

### In Admin Panel:
1. Navigate to `/saas/admin/entity/tenant-management`
2. Look for the purple "Account: [type]" badge next to each tenant

### In Database:
```sql
-- Check subscription_type
SELECT id, name, subscription_type, tenant_type 
FROM tenants 
WHERE id = '<tenant-id>';

-- Check integration settings
SELECT tenant_id, provider, use_custom_credentials, settings->>'googleIntegrationTier' as tier
FROM tenant_integration_settings
WHERE tenant_id = '<tenant-id>' AND provider = 'google_sheets';
```

## Next Steps (Optional Improvements)

1. **Add Account Type to Account Panel**: Display account type in user profile/settings page
2. **Admin Validation**: Add validation in admin panel to prevent setting BYO credentials for individual accounts
3. **Migration Script**: Create a script to fix existing individual accounts that have incorrect BYO settings

