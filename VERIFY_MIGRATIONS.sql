-- Verification Queries for Remote Database Migrations
-- Run these in Supabase SQL Editor to verify migrations were applied successfully
-- https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/sql/new

-- ============================================================================
-- 1. Check if all tables exist
-- ============================================================================
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('categorization_jobs', 'categorized_transactions', 'user_category_mappings', 'documents', 'cloud_storage_connections') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('categorization_jobs', 'categorized_transactions', 'user_category_mappings', 'documents', 'cloud_storage_connections')
ORDER BY table_name;

-- ============================================================================
-- 2. Check table columns for categorization_jobs
-- ============================================================================
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'categorization_jobs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. Check RLS policies
-- ============================================================================
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('categorization_jobs', 'categorized_transactions', 'user_category_mappings', 'documents', 'cloud_storage_connections')
ORDER BY tablename, policyname;

-- ============================================================================
-- 4. Check indexes
-- ============================================================================
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('categorization_jobs', 'categorized_transactions', 'user_category_mappings', 'documents', 'cloud_storage_connections')
ORDER BY tablename, indexname;

-- ============================================================================
-- 5. Check storage bucket
-- ============================================================================
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'categorization-uploads';

-- ============================================================================
-- 6. Check storage policies (RLS policies on storage.objects)
-- ============================================================================
SELECT 
  policyname as policy_name,
  tablename,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%categorization-uploads%'
ORDER BY cmd, policyname;

-- ============================================================================
-- 7. Check triggers
-- ============================================================================
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
  AND event_object_table IN ('categorized_transactions', 'user_category_mappings', 'documents', 'cloud_storage_connections')
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 8. Check function exists
-- ============================================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'update_updated_at_column';

-- ============================================================================
-- Summary Check (Expected Results)
-- ============================================================================
-- Expected Tables: 5
--   - categorization_jobs ✅
--   - categorized_transactions ✅
--   - user_category_mappings ✅
--   - documents ✅
--   - cloud_storage_connections ✅
--
-- Expected Storage Bucket: 1
--   - categorization-uploads ✅
--
-- Expected RLS Policies: ~15-20 policies across all tables
-- Expected Indexes: ~15-20 indexes across all tables
-- Expected Triggers: 4 (one for each table with updated_at)
