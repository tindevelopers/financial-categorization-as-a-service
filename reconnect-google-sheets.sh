#!/bin/bash

# Script to Reconnect Google Sheets in Localhost
# This clears the old production tokens and helps you reconnect with localhost

echo "🔄 Reconnecting Google Sheets for Localhost..."
echo ""

# Step 1: Disconnect existing connection
echo "Step 1: Disconnecting existing Google Sheets connection..."
DISCONNECT_RESULT=$(curl -s -X POST http://localhost:3080/api/integrations/google-sheets/disconnect \
  -H "Content-Type: application/json" \
  -b cookies.txt 2>/dev/null)

echo "$DISCONNECT_RESULT" | jq '.' 2>/dev/null || echo "$DISCONNECT_RESULT"
echo ""

# Step 2: Get OAuth URL
echo "Step 2: Getting OAuth connection URL..."
echo ""
echo "📋 MANUAL STEPS REQUIRED:"
echo ""
echo "1. Go to: http://localhost:3080/dashboard/settings"
echo ""
echo "2. Find the 'Google Sheets' integration section"
echo ""
echo "3. Click 'Connect Google Account' or 'Reconnect'"
echo ""
echo "4. Authorize with your Google account"
echo ""
echo "5. You'll be redirected back to localhost"
echo ""
echo "6. Go to: http://localhost:3080/dashboard/settings/spreadsheets"
echo ""
echo "7. Your spreadsheets should now appear! ✅"
echo ""
echo "❓ If you don't see a 'Connect' button in Settings, the disconnect API might need authentication."
echo "   In that case, run this SQL in Supabase Studio:"
echo ""
echo "   DELETE FROM cloud_storage_connections WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL');"
echo "   DELETE FROM user_integrations WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL');"
echo ""
