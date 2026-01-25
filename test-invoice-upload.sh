#!/bin/bash

# Test Invoice/Receipt Upload Fix
# This script tests the invoice processing functionality

set -e

echo "🧪 Testing Invoice Upload & Processing"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo "📡 Checking if dev server is running..."
if curl -s http://localhost:3080 > /dev/null; then
    echo -e "${GREEN}✅ Dev server is running on http://localhost:3080${NC}"
else
    echo -e "${RED}❌ Dev server is not running. Start it with: pnpm dev:portal${NC}"
    exit 1
fi
echo ""

# Check console output for DEV MODE flag
echo "🔍 Checking for development mode..."
echo -e "${BLUE}Look for '[DEV MODE]' in the server console when uploading${NC}"
echo ""

# Instructions
echo "📋 Manual Test Steps:"
echo "===================="
echo ""
echo "1. Navigate to: ${BLUE}http://localhost:3080/dashboard/uploads/receipts${NC}"
echo ""
echo "2. Click '${BLUE}Upload Invoice/Receipt${NC}' button"
echo ""
echo "3. Select a test file (PDF, JPG, or PNG)"
echo ""
echo "4. Click '${BLUE}Upload & Process${NC}'"
echo ""
echo "5. Watch the console output. You should see:"
echo "   ${GREEN}[DEV MODE] Starting inline processing for job <jobId>${NC}"
echo ""
echo "6. Processing should complete within 1-2 minutes"
echo ""
echo "7. Status should change to '${GREEN}Ready for Review${NC}' or '${GREEN}Completed${NC}'"
echo ""
echo ""
echo "✅ Expected Behavior:"
echo "===================="
echo "- No 'Processing is taking longer than expected' error before 5 minutes"
echo "- Console shows [DEV MODE] messages"
echo "- Job completes successfully"
echo "- Invoice appears in the list below"
echo ""
echo "❌ If It Fails:"
echo "=============="
echo "1. Check server logs:"
echo "   ${BLUE}tail -f apps/portal/.logs/server.log${NC}"
echo ""
echo "2. Check for OCR errors:"
echo "   ${BLUE}grep -i 'error\|fail' apps/portal/.logs/server.log${NC}"
echo ""
echo "3. Verify Google credentials:"
echo "   ${BLUE}echo \$GOOGLE_CREDENTIALS | base64 -d | jq '.project_id'${NC}"
echo ""
echo "4. Check database connection:"
echo "   ${BLUE}echo \$NEXT_PUBLIC_SUPABASE_URL${NC}"
echo ""
echo ""
echo "🌐 Opening browser..."
sleep 2
open "http://localhost:3080/dashboard/uploads/receipts" 2>/dev/null || echo "Please manually open: http://localhost:3080/dashboard/uploads/receipts"
echo ""
echo -e "${GREEN}✅ Test setup complete!${NC}"
echo "Now follow the manual test steps above."
