# Create Platform Admin User

This script creates the highest-level user account with **Platform Admin** privileges.

## User Details

- **Email**: `systemadmin@tin.info`
- **Password**: `88888888`
- **Role**: Platform Admin (system-level access)
- **Tenant**: NULL (can access all tenants)
- **Plan**: Enterprise
- **Status**: Active

## Prerequisites

### Step 1: Get Your Remote Supabase Keys

1. Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/settings/api
2. Copy these two keys:
   - **`anon` (public)** key
   - **`service_role` (secret)** key ⚠️ **Keep this secret!**

### Step 2: Update Your .env.local File

Update `/Users/gene/Projects/financial-categorization-as-a-service/.env.local` with the remote keys:

```bash
# Remote Supabase (Production)
NEXT_PUBLIC_SUPABASE_URL=https://firwcvlikjltikdrmejq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-your-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-your-service-role-key-here>
```

## Usage

### Option 1: Automated Script (Recommended)

Run the script from the project root:

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service
npx tsx scripts/create-platform-admin.ts
```

The script will:
1. ✅ Check if Platform Admin role exists (creates it if needed)
2. ✅ Check if user already exists
3. ✅ Create auth user with email/password
4. ✅ Create public.users record with Platform Admin role
5. ✅ Set tenant_id to NULL for system-level access
6. ✅ Verify setup is complete

### Option 2: Manual via Supabase Dashboard

If the script doesn't work due to key issues:

1. **Create auth user:**
   - Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/auth/users
   - Click "Add User"
   - Email: `systemadmin@tin.info`
   - Password: `88888888`
   - ✓ Check "Auto Confirm User"
   - Click "Create User"
   - **Copy the User ID (UUID)**

2. **Create public.users record:**
   - Go to: SQL Editor
   - Run this (replace `YOUR_USER_UUID_HERE`):

```sql
-- Create Platform Admin role if not exists
INSERT INTO public.roles (name, description, coverage, permissions, gradient, max_seats, current_seats)
VALUES (
  'Platform Admin',
  'Full system administrator with access to all tenants and system settings',
  'platform',
  ARRAY['*'],
  'bg-gradient-to-r from-purple-600 to-blue-600',
  0,
  0
)
ON CONFLICT (name) DO NOTHING;

-- Create public.users record
INSERT INTO public.users (
  id,
  email,
  full_name,
  role_id,
  tenant_id,
  plan,
  status
)
SELECT 
  'YOUR_USER_UUID_HERE'::UUID,  -- Replace with actual UUID from step 1
  'systemadmin@tin.info',
  'System Administrator',
  (SELECT id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1),
  NULL,  -- Platform Admins have NULL tenant_id
  'enterprise',
  'active'
ON CONFLICT (id) DO UPDATE
SET 
  role_id = (SELECT id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1),
  tenant_id = NULL,
  status = 'active';
```

## Verification

After running the script or manual setup, verify the user:

```sql
-- Run in Supabase SQL Editor
SELECT 
  u.id,
  u.email,
  u.full_name,
  r.name as role_name,
  r.coverage,
  u.tenant_id,
  u.status
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
WHERE u.email = 'systemadmin@tin.info';
```

You should see:
- ✅ `role_name`: "Platform Admin"
- ✅ `coverage`: "platform"
- ✅ `tenant_id`: NULL
- ✅ `status`: "active"

## Testing Sign In

1. Go to: http://localhost:3001/signin (local) or your production URL
2. Email: `systemadmin@tin.info`
3. Password: `88888888`
4. You should be redirected to the admin dashboard with full system access

## Troubleshooting

### "Invalid API key" Error

**Problem**: The script shows "Invalid API key" error

**Solution**: Your `.env.local` has the local Supabase keys, not the remote ones.

1. Get remote keys from: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/settings/api
2. Update `.env.local` with the remote `service_role` key
3. Run the script again

### "User already exists" Error

**Problem**: User exists but with wrong role or tenant

**Solution**: The script will automatically update the existing user to Platform Admin

### Creating Additional Platform Admins

To create `developer@tin.info`, modify the script constants:

```typescript
const ADMIN_EMAIL = "developer@tin.info";
const ADMIN_PASSWORD = "88888888";
const ADMIN_FULL_NAME = "Developer User";
```

Then run: `npx tsx scripts/create-platform-admin.ts`

## What is Platform Admin?

**Platform Admin** is the highest privilege level in the system:

- ✅ **System-level access**: `tenant_id = NULL`
- ✅ **Can access all tenants**: No tenant restrictions
- ✅ **Full permissions**: `permissions = ['*']`
- ✅ **Manage users**: Create/edit/delete any user
- ✅ **Manage tenants**: Create/edit/delete any tenant
- ✅ **View all data**: Access all records across all tenants
- ✅ **System configuration**: Change global settings

**Security Note**: Only create Platform Admin accounts for trusted system administrators.

## Next Steps

After creating the Platform Admin:

1. ✅ Test sign in at `/signin`
2. ✅ Verify dashboard access
3. ✅ Create additional users/tenants via the admin interface
4. ✅ Update Vercel environment variables with remote keys
5. ✅ Deploy to production
