# Supabase Setup Guide

This guide will help you set up Supabase for user, tenant, and role management.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Step 1: Create Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to your Supabase project dashboard
   - Navigate to Settings → API
   - Copy your Project URL and anon/public key

3. Update `.env.local` with your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 2: Run Database Migrations

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `src/lib/supabase/migrations.sql`
4. Paste and run the SQL in the SQL Editor

This will create:
- `tenants` table
- `roles` table  
- `users` table
- Indexes for performance
- Row Level Security (RLS) policies
- Default roles (Platform Admin, Workspace Admin, etc.)

## Step 3: Configure Row Level Security (Optional)

The migration includes basic RLS policies that allow all operations for authenticated users. For production, you should customize these policies based on your security requirements.

To customize:
1. Go to Authentication → Policies in your Supabase dashboard
2. Review and modify the policies for `tenants`, `roles`, and `users` tables
3. Consider implementing tenant isolation and role-based access control

## Step 4: Verify Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to:
   - User Management: http://localhost:3000/saas/admin/entity/user-management
   - Tenant Management: http://localhost:3000/saas/admin/entity/tenant-management
   - Role Management: http://localhost:3000/saas/admin/entity/role-management

3. You should see empty tables (or default roles if migrations ran successfully)

## Database Schema

### Tenants Table
- `id` (UUID, primary key)
- `name` (text)
- `domain` (text, unique)
- `status` (active/pending/suspended)
- `plan` (text)
- `region` (text)
- `avatar_url` (text, nullable)
- `features` (text array)
- `created_at`, `updated_at` (timestamps)

### Roles Table
- `id` (UUID, primary key)
- `name` (text, unique)
- `description` (text)
- `coverage` (text)
- `max_seats` (integer)
- `current_seats` (integer)
- `permissions` (text array)
- `gradient` (text)
- `created_at`, `updated_at` (timestamps)

### Users Table
- `id` (UUID, primary key)
- `email` (text, unique)
- `full_name` (text)
- `avatar_url` (text, nullable)
- `role_id` (UUID, foreign key to roles)
- `tenant_id` (UUID, foreign key to tenants)
- `plan` (text)
- `status` (active/pending/suspended)
- `last_active_at` (timestamp, nullable)
- `created_at`, `updated_at` (timestamps)

## Next Steps

- Add authentication integration
- Implement CRUD operations UI
- Add real-time subscriptions for live updates
- Customize RLS policies for your security model

