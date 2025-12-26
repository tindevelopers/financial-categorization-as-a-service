-- Migration: Migrate Bank Accounts from JSONB to Dedicated Table
-- Description: Extract bank accounts from company_profiles.bank_accounts JSONB and create records in bank_accounts table
-- Created: 2025-12-26

-- ============================================================================
-- MIGRATE BANK ACCOUNTS FROM JSONB
-- ============================================================================

DO $$
DECLARE
  profile_record RECORD;
  bank_account_record JSONB;
  new_bank_account_id UUID;
BEGIN
  -- Loop through all company_profiles with bank_accounts
  FOR profile_record IN 
    SELECT id, user_id, tenant_id, bank_accounts
    FROM company_profiles
    WHERE bank_accounts IS NOT NULL 
      AND jsonb_array_length(bank_accounts) > 0
  LOOP
    -- Loop through each bank account in the JSONB array
    FOR bank_account_record IN 
      SELECT * FROM jsonb_array_elements(profile_record.bank_accounts)
    LOOP
      -- Extract bank account details
      -- Skip if account already exists (check by user_id and account details)
      IF NOT EXISTS (
        SELECT 1 FROM bank_accounts
        WHERE user_id = profile_record.user_id
          AND account_name = bank_account_record->>'name'
          AND COALESCE(sort_code, '') = COALESCE(bank_account_record->>'sort_code', '')
          AND COALESCE(account_number, '') = COALESCE(bank_account_record->>'account_number', '')
      ) THEN
        -- Insert bank account
        INSERT INTO bank_accounts (
          user_id,
          tenant_id,
          company_profile_id,
          account_name,
          account_type,
          bank_name,
          sort_code,
          account_number,
          currency,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          profile_record.user_id,
          profile_record.tenant_id,
          profile_record.id,
          COALESCE(bank_account_record->>'name', 'Unnamed Account'),
          CASE 
            WHEN bank_account_record->>'type' IN ('checking', 'savings', 'credit_card', 'business') 
            THEN bank_account_record->>'type'
            ELSE 'checking'
          END,
          COALESCE(bank_account_record->>'bank', 'Unknown Bank'),
          bank_account_record->>'sort_code',
          bank_account_record->>'account_number',
          COALESCE(bank_account_record->>'currency', 'GBP'),
          TRUE,
          NOW(),
          NOW()
        )
        RETURNING id INTO new_bank_account_id;
        
        -- Set spreadsheet_tab_name to account_name if not set
        UPDATE bank_accounts
        SET spreadsheet_tab_name = account_name
        WHERE id = new_bank_account_id
          AND spreadsheet_tab_name IS NULL;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- BACKFILL BANK_ACCOUNT_ID FOR EXISTING TRANSACTIONS
-- ============================================================================

-- Link transactions to bank accounts via their job
UPDATE categorized_transactions ct
SET bank_account_id = cj.bank_account_id
FROM categorization_jobs cj
WHERE ct.job_id = cj.id
  AND cj.bank_account_id IS NOT NULL
  AND ct.bank_account_id IS NULL;

-- ============================================================================
-- BACKFILL BANK_ACCOUNT_ID FOR EXISTING FINANCIAL_DOCUMENTS
-- ============================================================================

-- Link financial_documents to bank accounts via their job
UPDATE financial_documents fd
SET bank_account_id = cj.bank_account_id
FROM categorization_jobs cj
WHERE fd.job_id = cj.id
  AND cj.bank_account_id IS NOT NULL
  AND fd.bank_account_id IS NULL;

-- ============================================================================
-- CREATE DEFAULT SPREADSHEET TABS FOR EXISTING BANK ACCOUNTS
-- ============================================================================

-- This will be done per-user when they access the spreadsheet tabs page
-- No automatic creation here to avoid conflicts

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION match_transaction_with_document IS 'Migration completed: Bank accounts migrated from JSONB to dedicated table';

