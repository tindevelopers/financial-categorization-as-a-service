#!/bin/bash

# Vercel Build Monitor - Watches for new deployments and status changes
# Usage: ./watch-vercel-build.sh

echo "🔍 Vercel Build Monitor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Watching for new deployments..."
echo "Press Ctrl+C to stop"
echo ""

get_latest_deployment() {
  vercel ls --yes 2>&1 | grep -E "https://" | head -1
}

LAST_DEPLOYMENT=""
CHECK_COUNT=0

while true; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  CURRENT=$(get_latest_deployment)
  
  if [ -n "$CURRENT" ]; then
    URL=$(echo "$CURRENT" | grep -oE "https://[^ ]+")
    STATUS=$(echo "$CURRENT" | grep -oE "● [A-Za-z]+" | sed 's/● //')
    AGE=$(echo "$CURRENT" | awk '{print $1}')
    
    # Check if this is a new deployment
    if [ "$URL" != "$LAST_DEPLOYMENT" ]; then
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "🆕 NEW DEPLOYMENT DETECTED!"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      LAST_DEPLOYMENT="$URL"
    fi
    
    # Display status
    TIMESTAMP=$(date +%H:%M:%S)
    printf "[%s] Check #%d | Status: %-8s | Age: %s\n" "$TIMESTAMP" "$CHECK_COUNT" "$STATUS" "$AGE"
    
    # Handle different statuses
    case "$STATUS" in
      "Error")
        echo "   ❌ Build failed!"
        echo "   📋 URL: $URL"
        echo "   💡 To inspect: vercel inspect $URL"
        echo "   💡 Dashboard: https://vercel.com/tindeveloper/financial-categorization-as-a-service"
        ;;
      "Ready")
        echo "   ✅ Build successful! Deployment is live."
        echo "   🌐 URL: $URL"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🎉 Deployment completed successfully!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        break
        ;;
      "Building")
        echo "   ⏳ Build in progress..."
        ;;
      "Queued")
        echo "   📋 Build queued, waiting to start..."
        ;;
    esac
  else
    echo "[$(date +%H:%M:%S)] No deployments found"
  fi
  
  sleep 10
done

