#!/bin/bash

# View server logs script
# Usage: ./scripts/view-logs.sh [portal|admin]

APP=${1:-portal}
LOG_FILE="apps/$APP/.logs/server.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "⚠️  Log file not found: $LOG_FILE"
    echo ""
    echo "Logs will be created when the server writes to them."
    echo "Make a request to trigger logging, or check your server terminal."
    echo ""
    echo "To see logs in real-time, restart the server in a visible terminal:"
    echo "  npm run dev"
    exit 1
fi

echo "📋 Viewing logs from: $LOG_FILE"
echo "Press Ctrl+C to exit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

tail -f "$LOG_FILE"


