-- Migration: Create Financial Documents Storage Bucket
-- Supabase storage bucket for financial document uploads
-- Created: 2025-12-20

-- Create storage bucket for financial documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-documents',
  'financial-documents',
  false, -- Private bucket
  52428800, -- 50MB limit per file
  ARRAY[
    -- PDFs
    'application/pdf',
    -- Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
    -- Spreadsheets
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv',
    'application/csv',
    -- Word documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/msword', -- .doc
    -- Text files
    'text/plain',
    -- Open document formats
    'application/vnd.oasis.opendocument.spreadsheet', -- .ods
    'application/vnd.oasis.opendocument.text' -- .odt
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for financial-documents bucket

-- Users can upload files to their own folder (user_id/entity_id/filename)
CREATE POLICY "Users can upload their own financial documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'financial-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view their own financial documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'financial-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own files
CREATE POLICY "Users can update their own financial documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'financial-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own financial documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'financial-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role (for background jobs like archiving) can access all files
-- Note: Service role bypasses RLS by default, but this is explicit documentation
