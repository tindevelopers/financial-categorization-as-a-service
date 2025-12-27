#!/bin/bash
# Deploy Edge Functions for Tenant OAuth Credentials

set -e

echo "🚀 Deploying Supabase Edge Functions"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

# Check if project is linked
if [ ! -f supabase/.temp/project-ref ]; then
    echo "📋 Linking to Supabase project..."
    supabase link --project-ref firwcvlikjltikdrmejq
fi

# Handle .env.local parsing issue
if [ -f .env.local ]; then
    echo "⚠️  Temporarily renaming .env.local to avoid parsing issues..."
    mv .env.local .env.local.backup
    trap "mv .env.local.backup .env.local 2>/dev/null || true" EXIT
fi

echo ""
echo "📦 Deploying get-tenant-credentials function..."
supabase functions deploy get-tenant-credentials --project-ref firwcvlikjltikdrmejq --no-verify-jwt

echo ""
echo "📦 Deploying set-tenant-credentials function..."
supabase functions deploy set-tenant-credentials --project-ref firwcvlikjltikdrmejq --no-verify-jwt

echo ""
echo "✅ Edge Functions deployed successfully!"
echo ""
echo "Functions are now available at:"
echo "  - https://firwcvlikjltikdrmejq.supabase.co/functions/v1/get-tenant-credentials"
echo "  - https://firwcvlikjltikdrmejq.supabase.co/functions/v1/set-tenant-credentials"
echo ""
echo "Next steps:"
echo "  1. Verify deployment in Supabase Dashboard > Functions"
echo "  2. Test functions using TESTING_GUIDE.md"
echo "  3. Set tenant secrets when ready"

