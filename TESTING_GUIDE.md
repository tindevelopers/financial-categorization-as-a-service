# Testing Guide - Phase 2 & 3

## Quick Start Testing

### 1. Ensure Supabase is Running

```bash
# Check Supabase status
supabase status

# If not running, start it
supabase start
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test Signup Flow

1. Navigate to: `http://localhost:3000/signup`
2. Fill in the form:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john@example.com`
   - Organization Name: `Acme Corp`
   - Organization Domain: `acme.com` (optional)
   - Password: `testpassword123`
   - Check "Terms and Conditions"
3. Click "Sign Up"
4. Should redirect to `/saas/dashboard`

**Expected Result**: 
- ✅ Tenant created in database
- ✅ User account created
- ✅ User linked to tenant
- ✅ User assigned "Workspace Admin" role
- ✅ Redirected to dashboard

### 4. Test Signin Flow

1. Navigate to: `http://localhost:3000/signin`
2. Enter credentials:
   - Email: `john@example.com`
   - Password: `testpassword123`
3. Click "Sign In"
4. Should redirect to `/saas/dashboard`

**Expected Result**:
- ✅ User authenticated
- ✅ Session created
- ✅ Tenant context loaded
- ✅ Redirected to dashboard

### 5. Test Tenant Isolation

1. **Create Second Tenant**:
   - Sign out
   - Sign up with different email: `alice@techstart.io`
   - Organization: `TechStart Inc`
   - Domain: `techstart.io`

2. **Verify Isolation**:
   - Sign in as first user (`john@example.com`)
   - Go to User Management (`/saas/admin/entity/user-management`)
   - Should only see users from Acme Corp tenant
   - Sign out
   - Sign in as second user (`alice@techstart.io`)
   - Go to User Management
   - Should only see users from TechStart Inc tenant

**Expected Result**:
- ✅ Users can only see their own tenant's data
- ✅ No cross-tenant data leakage
- ✅ RLS policies working correctly

### 6. Test Permissions

1. **Check User Role**:
   - Sign in as any user
   - Check their role in the database or user management page
   - Should have "Workspace Admin" role by default

2. **Test Permission Checks**:
   - Users with "Workspace Admin" should be able to:
     - View users
     - Create users
     - Update users
     - View tenants
     - Update tenants
   - Users with "Viewer" role should only be able to:
     - View users
     - View tenants
     - View roles

### 7. Database Verification

Open Supabase Studio: `http://127.0.0.1:54323`

1. **Check Tenants Table**:
   ```sql
   SELECT * FROM tenants;
   ```
   Should show all created tenants.

2. **Check Users Table**:
   ```sql
   SELECT * FROM users;
   ```
   Should show all users with their tenant_id.

3. **Test RLS Policies**:
   - In Supabase Studio, try querying as different users
   - Should only see data from their tenant

## Automated Testing

Run the test script:

```bash
npx tsx test-multi-tenant.ts
```

This will:
- Create test tenants
- Create test users
- Test tenant isolation
- Test permissions
- Verify RLS policies

## Common Issues & Solutions

### Issue: "Failed to sign up"
**Solution**: 
- Check Supabase is running: `supabase status`
- Check `.env.local` has correct credentials
- Check browser console for errors

### Issue: "User already exists"
**Solution**: 
- Use a different email
- Or delete user from Supabase Studio

### Issue: "Can see other tenant's data"
**Solution**: 
- Verify RLS policies are applied: `supabase db reset`
- Check user's tenant_id matches expected tenant
- Verify middleware is setting tenant context

### Issue: "Permission denied"
**Solution**: 
- Check user's role in database
- Verify role has required permissions
- Check RLS policies allow the operation

## Next Steps After Testing

Once testing is complete:

1. ✅ Verify all features work
2. ✅ Document any issues found
3. ✅ Test with multiple tenants
4. ✅ Test edge cases
5. ✅ Verify security (no data leakage)

## Success Criteria

- [ ] Can sign up new users
- [ ] Can sign in existing users
- [ ] Tenant isolation works (no cross-tenant data)
- [ ] Permissions work correctly
- [ ] RLS policies enforce isolation
- [ ] User management shows correct data
- [ ] Protected routes work

## Need Help?

Check these files:
- `PHASE_2_3_COMPLETE.md` - Implementation details
- `MULTI_TENANT_PLAN.md` - Full plan
- `LOCAL_SETUP.md` - Supabase setup guide

