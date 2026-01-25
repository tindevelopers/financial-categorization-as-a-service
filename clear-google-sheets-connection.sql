-- Clear Google Sheets Connection for Local Reconnection
-- Run this in Supabase SQL Editor if you need to clear the existing connection

-- First, find your user_id by email
SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';

-- Copy the user_id from above, then run these queries:

-- Clear from cloud_storage_connections table
DELETE FROM cloud_storage_connections 
WHERE user_id = 'YOUR_USER_ID_HERE' 
AND provider = 'google_sheets';

-- Clear from user_integrations table  
DELETE FROM user_integrations 
WHERE user_id = 'YOUR_USER_ID_HERE' 
AND provider = 'google_sheets';

-- Verify it's cleared
SELECT * FROM cloud_storage_connections WHERE user_id = 'YOUR_USER_ID_HERE';
SELECT * FROM user_integrations WHERE user_id = 'YOUR_USER_ID_HERE';
