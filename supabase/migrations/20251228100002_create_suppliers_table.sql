-- Migration: Create Suppliers Table
-- Stores supplier/vendor contact information extracted from invoices
-- Created: 2025-12-28

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Supplier identification
  name TEXT NOT NULL,
  display_name TEXT, -- Alternative name or trading name
  
  -- Contact information
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Address
  address_street TEXT,
  address_city TEXT,
  address_postcode TEXT,
  address_country TEXT DEFAULT 'United Kingdom',
  address_full JSONB DEFAULT '{}', -- Full address as JSON for flexibility
  
  -- Additional details
  vat_number TEXT,
  company_number TEXT, -- Companies House number for UK companies
  notes TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  
  -- Tracking
  first_seen_at TIMESTAMP DEFAULT NOW(), -- First invoice from this supplier
  last_seen_at TIMESTAMP DEFAULT NOW(), -- Most recent invoice
  document_count INTEGER DEFAULT 0, -- Number of documents from this supplier
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one supplier per name per user
  CONSTRAINT suppliers_user_name_unique UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_last_seen ON suppliers(last_seen_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_suppliers_search 
  ON suppliers 
  USING gin(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(display_name, '') || ' ' || COALESCE(email, '')));

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop if exists to make idempotent)
DROP POLICY IF EXISTS "Users can view their own suppliers" ON suppliers;
CREATE POLICY "Users can view their own suppliers"
  ON suppliers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own suppliers" ON suppliers;
CREATE POLICY "Users can create their own suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own suppliers" ON suppliers;
CREATE POLICY "Users can update their own suppliers"
  ON suppliers FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own suppliers" ON suppliers;
CREATE POLICY "Users can delete their own suppliers"
  ON suppliers FOR DELETE
  USING (auth.uid() = user_id);

-- Function to get or create supplier
CREATE OR REPLACE FUNCTION get_or_create_supplier(
  p_user_id UUID,
  p_tenant_id UUID,
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_postcode TEXT DEFAULT NULL,
  p_address_country TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id UUID;
BEGIN
  -- Try to find existing supplier by name
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE user_id = p_user_id AND LOWER(name) = LOWER(p_name)
  LIMIT 1;
  
  IF v_supplier_id IS NULL THEN
    -- Create new supplier
    INSERT INTO suppliers (
      user_id,
      tenant_id,
      name,
      email,
      phone,
      website,
      address_street,
      address_city,
      address_postcode,
      address_country,
      first_seen_at,
      last_seen_at,
      document_count
    ) VALUES (
      p_user_id,
      p_tenant_id,
      p_name,
      p_email,
      p_phone,
      p_website,
      p_address_street,
      p_address_city,
      p_address_postcode,
      COALESCE(p_address_country, 'United Kingdom'),
      NOW(),
      NOW(),
      1
    )
    RETURNING id INTO v_supplier_id;
  ELSE
    -- Update existing supplier (merge contact info if missing)
    UPDATE suppliers
    SET 
      email = COALESCE(suppliers.email, p_email),
      phone = COALESCE(suppliers.phone, p_phone),
      website = COALESCE(suppliers.website, p_website),
      address_street = COALESCE(suppliers.address_street, p_address_street),
      address_city = COALESCE(suppliers.address_city, p_address_city),
      address_postcode = COALESCE(suppliers.address_postcode, p_address_postcode),
      address_country = COALESCE(suppliers.address_country, p_address_country),
      last_seen_at = NOW(),
      document_count = document_count + 1,
      updated_at = NOW()
    WHERE id = v_supplier_id;
  END IF;
  
  RETURN v_supplier_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_supplier TO authenticated;

-- Comments
COMMENT ON TABLE suppliers IS 'Stores supplier/vendor contact information extracted from invoices';
COMMENT ON FUNCTION get_or_create_supplier IS 'Gets existing supplier or creates a new one, merging contact information';

