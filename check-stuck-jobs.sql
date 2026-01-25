-- Query to find stuck jobs
SELECT 
  id,
  original_filename,
  status,
  status_message,
  created_at,
  started_at,
  processing_mode,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_since_created
FROM categorization_jobs
WHERE status IN ('received', 'queued', 'processing')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
