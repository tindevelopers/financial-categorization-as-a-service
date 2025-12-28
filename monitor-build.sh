#!/bin/bash

# Simple Vercel build monitor
# Checks for new deployments and their status

echo "🔍 Vercel Build Monitor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

LAST_URL=""

while true; do
  echo "[$(date +%H:%M:%S)] Checking deployments..."
  
  # Get deployments and extract the first one (most recent)
  DEPLOYMENTS=$(vercel ls --yes 2>&1)
  
  # Extract the first deployment line (skip headers)
  FIRST_DEPLOY=$(echo "$DEPLOYMENTS" | grep -E "https://" | head -1)
  
  if [ -n "$FIRST_DEPLOY" ]; then
    # Extract URL and status
    URL=$(echo "$FIRST_DEPLOY" | grep -oE "https://[^ ]+")
    STATUS=$(echo "$FIRST_DEPLOY" | grep -oE "● [A-Za-z]+" | sed 's/● //')
    AGE=$(echo "$FIRST_DEPLOY" | awk '{print $1}')
    
    if [ "$URL" != "$LAST_URL" ]; then
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "🆕 New deployment detected!"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      LAST_URL="$URL"
    fi
    
    echo "Status: $STATUS | Age: $AGE"
    echo "URL: $URL"
    
    case "$STATUS" in
      "Error")
        echo "❌ Build failed!"
        echo "💡 View details: https://vercel.com/tindeveloper/financial-categorization-as-a-service"
        echo "💡 Or run: vercel inspect $URL"
        ;;
      "Ready")
        echo "✅ Build successful!"
        echo "🎉 Deployment is live!"
        break
        ;;
      "Building")
        echo "⏳ Build in progress..."
        ;;
      "Queued")
        echo "📋 Build queued..."
        ;;
    esac
  else
    echo "No deployments found"
  fi
  
  echo ""
  sleep 10
done

