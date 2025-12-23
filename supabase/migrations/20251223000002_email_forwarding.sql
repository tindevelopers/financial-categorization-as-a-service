-- Migration: Email Forwarding Setup
-- Description: Add tables for email forwarding functionality to receive receipts via email
-- Created: 2025-12-23

-- Create email forwarding addresses table
CREATE TABLE IF NOT EXISTS email_forwarding_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL UNIQUE,  -- receipts-[userid]@yourdomain.com
  is_active BOOLEAN DEFAULT true,
  emails_received INTEGER DEFAULT 0,
  last_email_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_user_id 
  ON email_forwarding_addresses(user_id);

-- Create index on email_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_email 
  ON email_forwarding_addresses(email_address);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_active 
  ON email_forwarding_addresses(is_active) WHERE is_active = true;

-- Create email receipts table
CREATE TABLE IF NOT EXISTS email_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forwarding_address_id UUID REFERENCES email_forwarding_addresses(id) ON DELETE SET NULL,
  
  -- Email metadata
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Processing
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  attachments_count INTEGER DEFAULT 0,
  documents_created UUID[],  -- Array of financial_document IDs
  
  -- Raw email (for debugging and reprocessing)
  raw_email_json JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_receipts_user_id 
  ON email_receipts(user_id);

-- Create index on forwarding_address_id
CREATE INDEX IF NOT EXISTS idx_email_receipts_forwarding_address_id 
  ON email_receipts(forwarding_address_id);

-- Create index on processing_status
CREATE INDEX IF NOT EXISTS idx_email_receipts_status 
  ON email_receipts(processing_status);

-- Create index on received_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_email_receipts_received_at 
  ON email_receipts(received_at DESC);

-- Create index on documents_created for reverse lookups
CREATE INDEX IF NOT EXISTS idx_email_receipts_documents_created 
  ON email_receipts USING GIN(documents_created);

-- Enable RLS on email_forwarding_addresses
ALTER TABLE email_forwarding_addresses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own forwarding addresses" ON email_forwarding_addresses;
DROP POLICY IF EXISTS "Users can create their own forwarding addresses" ON email_forwarding_addresses;
DROP POLICY IF EXISTS "Users can update their own forwarding addresses" ON email_forwarding_addresses;
DROP POLICY IF EXISTS "Users can delete their own forwarding addresses" ON email_forwarding_addresses;

-- Policy: Users can only see their own forwarding addresses
CREATE POLICY "Users can view their own forwarding addresses"
  ON email_forwarding_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own forwarding addresses
CREATE POLICY "Users can create their own forwarding addresses"
  ON email_forwarding_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own forwarding addresses
CREATE POLICY "Users can update their own forwarding addresses"
  ON email_forwarding_addresses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own forwarding addresses
CREATE POLICY "Users can delete their own forwarding addresses"
  ON email_forwarding_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on email_receipts
ALTER TABLE email_receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own email receipts" ON email_receipts;
DROP POLICY IF EXISTS "Service role can insert email receipts" ON email_receipts;
DROP POLICY IF EXISTS "Service role can update email receipts" ON email_receipts;

-- Policy: Users can only see their own email receipts
CREATE POLICY "Users can view their own email receipts"
  ON email_receipts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert email receipts (for webhook)
CREATE POLICY "Service role can insert email receipts"
  ON email_receipts
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update email receipts (for processing)
CREATE POLICY "Service role can update email receipts"
  ON email_receipts
  FOR UPDATE
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE email_forwarding_addresses IS 'Stores unique email addresses for each user to forward receipts and invoices';
COMMENT ON TABLE email_receipts IS 'Tracks all emails received via forwarding addresses and their processing status';
COMMENT ON COLUMN email_receipts.documents_created IS 'Array of financial_document IDs created from email attachments';
COMMENT ON COLUMN email_receipts.raw_email_json IS 'Raw email data from webhook for debugging and reprocessing';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_forwarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS email_forwarding_addresses_updated_at ON email_forwarding_addresses;
DROP TRIGGER IF EXISTS email_receipts_updated_at ON email_receipts;

-- Trigger to automatically update updated_at on email_forwarding_addresses
CREATE TRIGGER email_forwarding_addresses_updated_at
  BEFORE UPDATE ON email_forwarding_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_email_forwarding_updated_at();

-- Trigger to automatically update updated_at on email_receipts
CREATE TRIGGER email_receipts_updated_at
  BEFORE UPDATE ON email_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_email_forwarding_updated_at();

