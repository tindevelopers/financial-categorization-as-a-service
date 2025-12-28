-- Migration: Extend Account Types and Add Suspense Account Support
-- Description: Support more payment methods (PayPal, cash, etc.) and auto-create suspense account for unmatched receipts
-- Created: 2025-12-28

-- ============================================================================
-- EXTEND ACCOUNT TYPES
-- ============================================================================

-- Drop existing constraint and add expanded account types
ALTER TABLE bank_accounts 
DROP CONSTRAINT IF EXISTS bank_accounts_account_type_check;

ALTER TABLE bank_accounts 
ADD CONSTRAINT bank_accounts_account_type_check 
CHECK (account_type IN (
  'checking', 'savings', 'credit_card', 'business', 
  'paypal', 'cash', 'petty_cash', 'suspense', 'other'
));

-- ============================================================================
-- ADD SUSPENSE ACCOUNT FLAG
-- ============================================================================

-- Add is_default_suspense flag to mark the default account for unmatched receipts
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS is_default_suspense BOOLEAN DEFAULT FALSE;

-- Ensure only one suspense account per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_default_suspense_unique
ON bank_accounts(user_id, is_default_suspense)
WHERE is_default_suspense = TRUE;

-- ============================================================================
-- GET OR CREATE SUSPENSE ACCOUNT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_suspense_account(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Try to find existing suspense account
  SELECT id INTO v_account_id
  FROM bank_accounts
  WHERE user_id = p_user_id AND is_default_suspense = TRUE
  LIMIT 1;
  
  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;
  
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id FROM users WHERE id = p_user_id;
  
  -- Create suspense account
  INSERT INTO bank_accounts (
    user_id, tenant_id, account_name, account_type, 
    bank_name, is_default_suspense, is_active
  ) VALUES (
    p_user_id, v_tenant_id, 'Unmatched Receipts', 'suspense',
    'System', TRUE, TRUE
  )
  RETURNING id INTO v_account_id;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN bank_accounts.is_default_suspense IS 'Flag indicating this is the default suspense account for unmatched receipts';
COMMENT ON FUNCTION get_or_create_suspense_account(UUID) IS 'Gets or creates a suspense account for storing unmatched receipts';

