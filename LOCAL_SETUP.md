# Local Supabase Development Setup

## Prerequisites

✅ Docker Desktop installed and running  
✅ Supabase CLI installed (`brew install supabase/tap/supabase`)

## Step-by-Step Setup

### 1. Start Docker Desktop
Make sure Docker Desktop is running before proceeding.

### 2. Start Local Supabase

```bash
cd /Users/gene/Projects/tinadmin-saas-base
supabase start
```

This will:
- Start all Supabase services in Docker containers
- Run your migrations automatically
- Display your local credentials

**Expected output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Configure Environment Variables

Create or update `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-start-output>
```

### 4. Verify Setup

1. **Check Supabase Studio:**
   - Open http://localhost:54323
   - You should see your tables: `tenants`, `roles`, `users`
   - Default roles should be populated

2. **Test Your App:**
   ```bash
   npm run dev
   ```
   - Navigate to http://localhost:3000/saas/admin/entity/user-management
   - You should see the page loading (may be empty until you add data)

### 5. Add Test Data (Optional)

You can add test data via Supabase Studio:
1. Go to http://localhost:54323
2. Navigate to Table Editor
3. Add tenants, roles, and users manually
4. Or use the SQL Editor to insert test data

## Daily Workflow

**Start development:**
```bash
# 1. Start Docker Desktop
# 2. Start Supabase
supabase start

# 3. Start Next.js dev server (in another terminal)
npm run dev
```

**Stop everything:**
```bash
supabase stop
# Stop Docker Desktop when done
```

**Reset database (fresh start):**
```bash
supabase db reset
# This runs all migrations from scratch
```

## Troubleshooting

**Docker not running:**
- Start Docker Desktop
- Wait for it to fully start
- Try `supabase start` again

**Port conflicts:**
- If ports 54321-54324 are in use, Supabase will show which ports it's using
- Update `.env.local` with the correct port

**Migration errors:**
- Check `supabase db reset` to reset and re-run migrations
- Check `supabase/migrations/` for migration files

**Can't connect:**
- Verify Docker is running: `docker ps`
- Check Supabase status: `supabase status`
- Verify `.env.local` has correct credentials

## Next Steps

Once local setup is working:
1. Test all CRUD operations locally
2. When ready, create Supabase cloud project
3. Use `supabase db push` to sync schema to production
4. Update production environment variables

