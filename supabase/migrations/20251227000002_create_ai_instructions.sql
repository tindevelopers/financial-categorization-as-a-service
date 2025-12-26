-- Migration: Create AI Categorization Instructions Table
-- Description: Store user and company-level AI instructions for categorization behavior
-- Created: 2025-12-27

CREATE TABLE IF NOT EXISTS ai_categorization_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  instruction_type TEXT NOT NULL 
    CHECK (instruction_type IN ('system_prompt', 'category_rules', 'exception_rules', 'format_preferences')),
  instructions TEXT NOT NULL, -- Detailed instructions (can be JSONB or plain text)
  priority INTEGER DEFAULT 0, -- Higher priority = applied first (company > user, higher number = higher priority)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure at least one of user_id or company_profile_id is set
  CONSTRAINT ai_instructions_has_owner CHECK (
    (user_id IS NOT NULL)::int + (company_profile_id IS NOT NULL)::int = 1
  )
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_instructions_user_id 
  ON ai_categorization_instructions(user_id, instruction_type, is_active) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_instructions_company_profile_id 
  ON ai_categorization_instructions(company_profile_id, instruction_type, is_active, priority DESC) 
  WHERE company_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_instructions_active 
  ON ai_categorization_instructions(is_active) 
  WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE ai_categorization_instructions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own instructions
CREATE POLICY "Users can view their own AI instructions"
  ON ai_categorization_instructions FOR SELECT
  USING (
    user_id = auth.uid() OR
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can view company-level instructions for their companies
CREATE POLICY "Users can view company AI instructions"
  ON ai_categorization_instructions FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles 
      WHERE user_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users can create their own instructions
CREATE POLICY "Users can create their own AI instructions"
  ON ai_categorization_instructions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can update their own instructions
CREATE POLICY "Users can update their own AI instructions"
  ON ai_categorization_instructions FOR UPDATE
  USING (
    user_id = auth.uid() OR
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own instructions
CREATE POLICY "Users can delete their own AI instructions"
  ON ai_categorization_instructions FOR DELETE
  USING (
    user_id = auth.uid() OR
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

-- Platform admins can manage all instructions
CREATE POLICY "Platform admins can manage all AI instructions"
  ON ai_categorization_instructions FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Trigger for updated_at
CREATE TRIGGER update_ai_categorization_instructions_updated_at
  BEFORE UPDATE ON ai_categorization_instructions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get merged AI instructions for a user/company
CREATE OR REPLACE FUNCTION get_merged_ai_instructions(
  p_user_id UUID,
  p_company_profile_id UUID DEFAULT NULL
)
RETURNS TABLE (
  instruction_type TEXT,
  instructions TEXT,
  priority INTEGER,
  source TEXT -- 'user' or 'company'
) AS $$
BEGIN
  RETURN QUERY
  -- Get user-level instructions
  SELECT 
    aci.instruction_type,
    aci.instructions,
    aci.priority,
    'user'::TEXT as source
  FROM ai_categorization_instructions aci
  WHERE aci.user_id = p_user_id
    AND aci.is_active = TRUE
    AND aci.company_profile_id IS NULL
  
  UNION ALL
  
  -- Get company-level instructions (if company_profile_id provided)
  SELECT 
    aci.instruction_type,
    aci.instructions,
    aci.priority,
    'company'::TEXT as source
  FROM ai_categorization_instructions aci
  WHERE aci.company_profile_id = p_company_profile_id
    AND aci.is_active = TRUE
    AND aci.user_id IS NULL
  
  ORDER BY priority DESC, source DESC; -- Company instructions (higher priority) come first
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_merged_ai_instructions TO authenticated;

-- Comments for documentation
COMMENT ON TABLE ai_categorization_instructions IS 'User and company-level AI instructions for transaction categorization behavior';
COMMENT ON COLUMN ai_categorization_instructions.instruction_type IS 'Type of instruction: system_prompt (override default behavior), category_rules (specific categorization rules), exception_rules (edge cases), format_preferences (formatting preferences)';
COMMENT ON COLUMN ai_categorization_instructions.instructions IS 'Detailed instruction text (can be JSONB or plain text)';
COMMENT ON COLUMN ai_categorization_instructions.priority IS 'Priority level - higher numbers are applied first. Company instructions typically have higher priority than user instructions';
COMMENT ON FUNCTION get_merged_ai_instructions IS 'Returns merged AI instructions for a user and optionally their company, with company instructions taking precedence';

