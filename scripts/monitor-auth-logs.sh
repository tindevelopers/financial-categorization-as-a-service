#!/bin/bash

# Monitor authentication logs from Cursor debug log
# This script watches the .cursor/debug.log file for auth-related events

LOG_FILE=".cursor/debug.log"
TAIL_COUNT=50

echo "🔍 Monitoring authentication logs..."
echo "📁 Log file: $LOG_FILE"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show recent auth logs
if [ -f "$LOG_FILE" ]; then
  echo "📋 Recent authentication events:"
  echo ""
  grep -E '"message":"auth\.' "$LOG_FILE" | tail -$TAIL_COUNT | while read line; do
    # Extract and format log entry
    echo "$line" | jq -r '[.timestamp, .message, .data.event // .message, .data.error // .data.userId // ""] | @tsv' 2>/dev/null || echo "$line"
  done
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi

# Watch for new auth events
if [ -f "$LOG_FILE" ]; then
  tail -f "$LOG_FILE" | grep --line-buffered '"message":"auth\.' | while read line; do
    timestamp=$(echo "$line" | jq -r '.timestamp' 2>/dev/null || echo "N/A")
    message=$(echo "$line" | jq -r '.message' 2>/dev/null || echo "N/A")
    event=$(echo "$line" | jq -r '.data.event // .message' 2>/dev/null || echo "N/A")
    error=$(echo "$line" | jq -r '.data.error // ""' 2>/dev/null || echo "")
    userId=$(echo "$line" | jq -r '.data.userId // ""' 2>/dev/null || echo "")
    
    if [ -n "$timestamp" ] && [ "$timestamp" != "null" ]; then
      date_str=$(date -r $(($timestamp / 1000)) '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "N/A")
    else
      date_str="N/A"
    fi
    
    echo "[$date_str] $event"
    if [ -n "$error" ] && [ "$error" != "null" ] && [ "$error" != "" ]; then
      echo "  ❌ Error: $error"
    fi
    if [ -n "$userId" ] && [ "$userId" != "null" ] && [ "$userId" != "" ]; then
      echo "  👤 User ID: $userId"
    fi
    echo ""
  done
else
  echo "⚠️  Log file not found: $LOG_FILE"
  echo "Waiting for log file to be created..."
  while [ ! -f "$LOG_FILE" ]; do
    sleep 1
  done
  echo "✅ Log file created, starting monitor..."
  exec "$0"
fi
