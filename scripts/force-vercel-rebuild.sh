#!/bin/bash

# Force Vercel to rebuild from scratch by clearing cache
# This script helps ensure the latest code is deployed

set -e

echo "🔄 Forcing Vercel rebuild from scratch..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install it with: npm install -g vercel"
    exit 1
fi

# Navigate to portal directory
cd "$(dirname "$0")/../apps/portal"

echo "📦 Current directory: $(pwd)"
echo ""

# Get the latest commit hash
LATEST_COMMIT=$(git rev-parse HEAD)
echo "📝 Latest commit: $LATEST_COMMIT"
echo ""

# Force rebuild by deploying with --force flag
echo "🚀 Deploying to Vercel with --force flag..."
echo "   This will bypass Vercel's build cache"
echo ""

vercel --prod --force

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📋 Next steps:"
echo "   1. Check Vercel dashboard for build progress"
echo "   2. Wait for deployment to complete"
echo "   3. Hard refresh the deployed site (Cmd+Shift+R)"
echo "   4. Verify the version indicator shows: v2.1-with-bulk-actions-2025-12-25-cache-bust"
echo ""

