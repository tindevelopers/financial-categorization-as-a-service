#!/bin/bash

# Monitor Vercel builds and check for new deployments
# Usage: ./monitor-vercel-build.sh

echo "🔍 Monitoring Vercel deployments..."
echo "Press Ctrl+C to stop"
echo ""

LAST_DEPLOYMENT=""
CHECK_COUNT=0

while true; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  echo "[$(date +%H:%M:%S)] Check #$CHECK_COUNT"
  
  # Get latest deployment
  LATEST=$(vercel ls --yes 2>&1 | tail -n +4 | head -1)
  
  if [ -n "$LATEST" ] && ! echo "$LATEST" | grep -q "Age\|Deployments"; then
    DEPLOYMENT_URL=$(echo "$LATEST" | awk '{print $2}')
    STATUS=$(echo "$LATEST" | awk '{print $3}')
    
    if [ "$DEPLOYMENT_URL" != "$LAST_DEPLOYMENT" ]; then
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "🆕 New deployment detected!"
      echo "URL: $DEPLOYMENT_URL"
      echo "Status: $STATUS"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      LAST_DEPLOYMENT="$DEPLOYMENT_URL"
    fi
    
    echo "Latest: $STATUS - $DEPLOYMENT_URL"
    
    if echo "$STATUS" | grep -q "Error"; then
      echo "❌ Build failed! Checking details..."
      vercel inspect "$DEPLOYMENT_URL" 2>&1 | head -30
      echo ""
      echo "💡 To see full logs, visit: https://vercel.com/tindeveloper/financial-categorization-as-a-service"
    elif echo "$STATUS" | grep -q "Ready"; then
      echo "✅ Build successful!"
      break
    elif echo "$STATUS" | grep -q "Building"; then
      echo "⏳ Build in progress..."
    fi
  fi
  
  echo ""
  sleep 10
done

