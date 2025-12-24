-- Create Test Company for Testing Week 1 Dashboard
-- Run this in Supabase SQL Editor AFTER signing in to the app

-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'your-email@example.com'; -- CHANGE THIS!

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Please sign in to the app first.';
  END IF;

  -- Create test company
  INSERT INTO companies (
    user_id,
    company_name,
    company_type,
    vat_registered,
    vat_scheme,
    financial_year_end,
    accounting_basis,
    setup_completed
  ) VALUES (
    v_user_id,
    'Test UK Company Ltd',
    'sole_trader',
    true,
    'standard',
    '2025-04-05', -- 5th April (UK tax year end)
    'cash',
    true -- Mark as completed so you can access dashboard
  );

  RAISE NOTICE 'Test company created successfully!';
END $$;

-- Verify it was created
SELECT 
  c.company_name,
  c.company_type,
  c.vat_registered,
  c.setup_completed,
  u.email
FROM companies c
JOIN auth.users u ON c.user_id = u.id
ORDER BY c.created_at DESC
LIMIT 1;

