#!/bin/bash
# Helper script to set real Google OAuth credentials for a tenant

set -e

TENANT_ID="9b74fb09-be2c-4b9b-814d-357337b3539c"
PROJECT_REF="firwcvlikjltikdrmejq"

echo "🔐 Set Real Google OAuth Credentials"
echo "====================================="
echo ""
echo "Tenant ID: $TENANT_ID"
echo ""

# Check if credentials are provided as arguments
if [ $# -eq 2 ]; then
    CLIENT_ID="$1"
    CLIENT_SECRET="$2"
else
    # Prompt for credentials
    echo "Enter your Google OAuth Client ID:"
    read -r CLIENT_ID
    
    echo ""
    echo "Enter your Google OAuth Client Secret:"
    read -r -s CLIENT_SECRET
    echo ""
fi

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "❌ Error: Both Client ID and Client Secret are required"
    exit 1
fi

# Handle .env.local
if [ -f .env.local ]; then
    echo "⚠️  Temporarily renaming .env.local..."
    mv .env.local .env.local.backup
    trap "mv .env.local.backup .env.local 2>/dev/null || true" EXIT
fi

echo ""
echo "Setting CLIENT_ID..."
supabase secrets set --project-ref "$PROJECT_REF" \
  "TENANT_${TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_ID=${CLIENT_ID}"

echo ""
echo "Setting CLIENT_SECRET..."
supabase secrets set --project-ref "$PROJECT_REF" \
  "TENANT_${TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_SECRET=${CLIENT_SECRET}"

echo ""
echo "✅ Credentials set successfully!"
echo ""
echo "To verify, run:"
echo "  supabase secrets list --project-ref $PROJECT_REF | grep TENANT_${TENANT_ID}"

