# Next Steps After Tenant Creation

## Current Status
✅ Tenant created: "SaaS Base" (domain: saas-base)  
❓ User account needs to be created

## Option 1: Complete Signup via Web Form (Recommended)

1. **Go to signup page**: `http://localhost:3000/signup`
2. **Fill in the form**:
   - Use a **different email** than what you tried before (or the same if it didn't create a user)
   - Use a **different domain** (or the same if you want to use the existing tenant)
   - Complete the signup process
3. **The system will**:
   - Create the user account
   - Link user to tenant
   - Assign "Workspace Admin" role
   - Redirect to dashboard

## Option 2: Create User Manually via Script

If you want to create a user for the existing tenant:

```bash
# Run the helper script
npx tsx scripts/create-user-for-tenant.ts <tenant-id> <email> <full-name> <password>

# Example:
npx tsx scripts/create-user-for-tenant.ts d0e6cbf4-cf74-4d49-a95c-2da69a33a5d admin@saas-base.com "Admin User" changeme123
```

Or use the default values:
```bash
npx tsx scripts/create-user-for-tenant.ts
```

## Option 3: Create User via Supabase Studio

1. **Open Supabase Studio**: `http://127.0.0.1:54323`
2. **Go to Authentication → Users**
3. **Click "Add user"**:
   - Email: `admin@saas-base.com`
   - Password: `changeme123`
   - Auto Confirm User: ✅ (checked)
4. **Go to Table Editor → users**
5. **Click "Insert row"**:
   - `id`: Copy the UUID from the auth user you just created
   - `email`: `admin@saas-base.com`
   - `full_name`: `Admin User`
   - `tenant_id`: `d0e6cbf4-cf74-4d49-a95c-2da69a33a5d` (your tenant ID)
   - `role_id`: Get from roles table (Workspace Admin role ID)
   - `plan`: `starter`
   - `status`: `active`

## What Happens After User Creation

Once you have a user:

1. **Sign In**: Go to `http://localhost:3000/signin`
2. **Enter credentials**: Email and password
3. **You'll be redirected** to `/saas/dashboard`
4. **Tenant context** will be loaded automatically
5. **You can now**:
   - View your tenant's data
   - Manage users (tenant-scoped)
   - Access all SaaS features

## Understanding the Relationship

```
Tenant (Organization)
  └── Users (People in the organization)
      └── Roles (Permissions for each user)
```

- **Tenant** = Your organization/company
- **Users** = People who belong to that organization
- **Roles** = What each user can do (Platform Admin, Workspace Admin, etc.)

## Recommended Next Steps

1. ✅ **Create a user** (use Option 1 - web form is easiest)
2. ✅ **Sign in** and verify tenant context loads
3. ✅ **Test tenant isolation** by creating a second tenant/user
4. ✅ **Verify RLS policies** are working (users only see their tenant's data)

## Troubleshooting

### If signup fails with "email already exists":
- The email is already in Supabase Auth
- Either use a different email, or sign in with that email
- Or delete the auth user from Supabase Studio first

### If you see "tenant_id is required":
- Make sure the user record has a `tenant_id` field set
- This links the user to their organization

### If RLS policies block access:
- Make sure the user's `tenant_id` matches the tenant they're trying to access
- Check that RLS policies are applied (they should be from migrations)

## Quick Test

After creating a user, test the flow:

```bash
# 1. Sign in at http://localhost:3000/signin
# 2. Check browser console - should see tenant loaded
# 3. Go to User Management - should see your user
# 4. Verify you can only see your tenant's data
```

