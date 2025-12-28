-- Verification Query: Check if Supplier Migrations Were Applied
-- Run this in Supabase SQL Editor to verify migrations are complete

-- 1. Check if suppliers table exists
SELECT 
  'suppliers table' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'suppliers'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 2. Check if financial_documents has supplier_id column
SELECT 
  'supplier_id column' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_documents' 
      AND column_name = 'supplier_id'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 3. Check if financial_documents has order_number column
SELECT 
  'order_number column' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_documents' 
      AND column_name = 'order_number'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 4. Check if financial_documents has delivery_date column
SELECT 
  'delivery_date column' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_documents' 
      AND column_name = 'delivery_date'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 5. Check if get_or_create_supplier function exists
SELECT 
  'get_or_create_supplier function' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'get_or_create_supplier'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- Summary: All checks in one query
SELECT 
  'SUMMARY' AS check_item,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers')
    AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_documents' AND column_name = 'supplier_id')
    AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_documents' AND column_name = 'order_number')
    AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_documents' AND column_name = 'delivery_date')
    AND EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_or_create_supplier')
    THEN '✅ ALL MIGRATIONS APPLIED'
    ELSE '❌ MIGRATIONS INCOMPLETE - Run supplier_migrations_to_apply.sql'
  END AS status;

