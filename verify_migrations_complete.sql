-- Comprehensive Migration Verification
-- Run this in Supabase SQL Editor to verify all migrations are complete

-- Check all required objects exist
WITH checks AS (
  SELECT 'suppliers table' AS check_item,
    EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'suppliers'
    ) AS exists_check
  UNION ALL
  SELECT 'supplier_id column in financial_documents',
    EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_documents' 
      AND column_name = 'supplier_id'
    )
  UNION ALL
  SELECT 'order_number column in financial_documents',
    EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_documents' 
      AND column_name = 'order_number'
    )
  UNION ALL
  SELECT 'delivery_date column in financial_documents',
    EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'financial_documents' 
      AND column_name = 'delivery_date'
    )
  UNION ALL
  SELECT 'get_or_create_supplier function',
    EXISTS (
      SELECT FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'get_or_create_supplier'
    )
  UNION ALL
  SELECT 'suppliers table RLS enabled',
    EXISTS (
      SELECT FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
      AND t.tablename = 'suppliers'
      AND c.relrowsecurity = true
    )
  UNION ALL
  SELECT 'supplier_id index exists',
    EXISTS (
      SELECT FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'financial_documents'
      AND indexname = 'idx_financial_documents_supplier_id'
    )
  UNION ALL
  SELECT 'order_number index exists',
    EXISTS (
      SELECT FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'financial_documents'
      AND indexname = 'idx_financial_documents_order_number'
    )
)
SELECT 
  check_item,
  CASE 
    WHEN exists_check THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM checks
ORDER BY check_item;

-- Summary
SELECT 
  'SUMMARY' AS check_item,
  CASE 
    WHEN 
      (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers'))
      AND (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_documents' AND column_name = 'supplier_id'))
      AND (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_documents' AND column_name = 'order_number'))
      AND (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_documents' AND column_name = 'delivery_date'))
      AND (SELECT EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_or_create_supplier'))
    THEN '✅ ALL MIGRATIONS COMPLETE'
    ELSE '❌ SOME MIGRATIONS MISSING'
  END AS status;

