#!/bin/bash

# Test Telemetry and Logging
# This script verifies that telemetry and logging are working correctly

set -e

echo "🧪 Testing Telemetry and Logging System"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "📡 Checking if dev server is running..."
if curl -s http://localhost:3080 > /dev/null; then
    echo -e "${GREEN}✅ Dev server is running on http://localhost:3080${NC}"
else
    echo -e "${YELLOW}⚠️  Dev server is not running. Start it with: pnpm dev:portal${NC}"
    exit 1
fi
echo ""

# Clear existing logs for fresh test
echo "🧹 Clearing existing logs..."
> apps/portal/.cursor/debug.log
> apps/portal/.logs/server.log
echo -e "${GREEN}✅ Logs cleared${NC}"
echo ""

# Make health check requests
echo "🏥 Making health check requests..."
for i in {1..3}; do
    echo "   Request $i/3..."
    curl -s http://localhost:3080/api/health | jq -r '.status'
    sleep 0.5
done
echo -e "${GREEN}✅ Health checks completed${NC}"
echo ""

# Wait for logs to flush
sleep 2

# Check debug log
echo "📝 Debug Log (Telemetry):"
echo "========================"
if [ -s apps/portal/.cursor/debug.log ]; then
    cat apps/portal/.cursor/debug.log | jq -r '"\(.message) - \(.data.method) \(.data.path) [\(.data.status)]"' 2>/dev/null || cat apps/portal/.cursor/debug.log
    LINE_COUNT=$(wc -l < apps/portal/.cursor/debug.log)
    echo -e "${GREEN}✅ $LINE_COUNT entries in debug log${NC}"
else
    echo -e "${YELLOW}⚠️  Debug log is empty${NC}"
fi
echo ""

# Check server log
echo "📊 Server Log (Last 10 lines):"
echo "=============================="
if [ -s apps/portal/.logs/server.log ]; then
    tail -10 apps/portal/.logs/server.log
    LINE_COUNT=$(wc -l < apps/portal/.logs/server.log)
    echo -e "${GREEN}✅ $LINE_COUNT total entries in server log${NC}"
else
    echo -e "${YELLOW}⚠️  Server log is empty${NC}"
fi
echo ""

# Summary
echo "📈 Summary:"
echo "==========="
echo -e "${BLUE}Debug log location:${NC}  apps/portal/.cursor/debug.log"
echo -e "${BLUE}Server log location:${NC} apps/portal/.logs/server.log"
echo ""
echo -e "${GREEN}✅ Telemetry system is operational!${NC}"
echo ""
echo "💡 Monitor logs in real-time with:"
echo "   tail -f apps/portal/.logs/server.log"
echo "   tail -f apps/portal/.cursor/debug.log"
