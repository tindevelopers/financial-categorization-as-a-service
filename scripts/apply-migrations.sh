#!/bin/bash
# Script to apply tenant OAuth credentials migrations

set -e

echo "🚀 Applying Tenant OAuth Credentials Migrations"
echo "================================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if .env.local exists and has parsing issues
if [ -f .env.local ]; then
    echo "⚠️  Temporarily renaming .env.local to avoid parsing issues..."
    mv .env.local .env.local.backup
    trap "mv .env.local.backup .env.local 2>/dev/null || true" EXIT
fi

# Check if project is linked
if [ ! -f supabase/.temp/project-ref ]; then
    echo "📋 Linking to Supabase project..."
    echo "   Project ref: firwcvlikjltikdrmejq"
    supabase link --project-ref firwcvlikjltikdrmejq
fi

# Apply migrations
echo ""
echo "📦 Applying database migrations..."
supabase db push --linked --include-all

# Deploy Edge Functions
echo ""
echo "🚀 Deploying Edge Functions..."

echo "   Deploying get-tenant-credentials..."
cd supabase/functions/get-tenant-credentials
supabase functions deploy get-tenant-credentials --linked --no-verify-jwt
cd ../../..

echo "   Deploying set-tenant-credentials..."
cd supabase/functions/set-tenant-credentials
supabase functions deploy set-tenant-credentials --linked --no-verify-jwt
cd ../../..

echo ""
echo "✅ Migrations and Edge Functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify migrations: Check Supabase Dashboard > Database > Tables"
echo "2. Test Edge Functions: Check Supabase Dashboard > Edge Functions"
echo "3. Run migration script: tsx scripts/migrate-to-supabase-secrets.ts"

