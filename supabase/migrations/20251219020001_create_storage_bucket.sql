-- Migration: Create Storage Bucket for Categorization Uploads
-- Phase 1: Storage bucket for temporary file uploads
-- Created: 2025-12-19

-- Create storage bucket for categorization uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'categorization-uploads',
  'categorization-uploads',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv', -- .csv
    'application/pdf' -- .pdf (for future invoice uploads)
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Users can upload their own files
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'categorization-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'categorization-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'categorization-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
