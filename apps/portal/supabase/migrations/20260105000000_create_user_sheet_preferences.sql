-- Migration: Add user sheet preferences
-- Date: 2026-01-05
-- This migration creates the user_sheet_preferences table for storing user's default Google Sheets export preferences

-- User's Google Sheets preferences (which sheet to export to)
CREATE TABLE IF NOT EXISTS user_sheet_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT,
  sheet_tab_name TEXT DEFAULT 'Transactions',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_sheet_preferences ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist before creating
DROP POLICY IF EXISTS "Users can view own sheet preferences" ON user_sheet_preferences;
DROP POLICY IF EXISTS "Users can insert own sheet preferences" ON user_sheet_preferences;
DROP POLICY IF EXISTS "Users can update own sheet preferences" ON user_sheet_preferences;
DROP POLICY IF EXISTS "Users can delete own sheet preferences" ON user_sheet_preferences;

-- Users can only see/edit their own preferences
CREATE POLICY "Users can view own sheet preferences"
  ON user_sheet_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sheet preferences"
  ON user_sheet_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sheet preferences"
  ON user_sheet_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sheet preferences"
  ON user_sheet_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sheet_preferences_user_id ON user_sheet_preferences(user_id);

