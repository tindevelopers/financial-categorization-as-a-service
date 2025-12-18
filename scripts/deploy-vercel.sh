#!/bin/bash

# Vercel Turborepo Deployment Script
# This script helps deploy both admin and portal apps to Vercel

set -e

echo "🚀 TinAdmin SaaS - Vercel Deployment"
echo "======================================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed."
    echo "Install it with: npm install -g vercel"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed."
    echo "Install it with: npm install -g pnpm"
    exit 1
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "⚠️  Not logged in to Vercel. Please run: vercel login"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Function to deploy an app
deploy_app() {
    local app_name=$1
    local app_dir=$2
    local project_name=$3
    
    echo "📦 Deploying $app_name..."
    echo "   Directory: $app_dir"
    echo "   Project: $project_name"
    echo ""
    
    cd "$app_dir"
    
    # Link to Vercel project if not already linked
    if [ ! -f ".vercel/project.json" ]; then
        echo "🔗 Linking to Vercel project..."
        vercel link --yes --project "$project_name" 2>/dev/null || vercel link --yes
    fi
    
    # Deploy
    echo "🚀 Deploying to Vercel..."
    vercel --prod --yes
    
    cd - > /dev/null
    echo "✅ $app_name deployed successfully!"
    echo ""
}

# Ask which apps to deploy
echo "Which apps would you like to deploy?"
echo "1) Admin app only"
echo "2) Portal app only"
echo "3) Both apps"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        deploy_app "Admin" "apps/admin" "tinadmin-admin"
        ;;
    2)
        deploy_app "Portal" "apps/portal" "tinadmin-portal"
        ;;
    3)
        deploy_app "Admin" "apps/admin" "tinadmin-admin"
        deploy_app "Portal" "apps/portal" "tinadmin-portal"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure custom domains in Vercel dashboard"
echo "2. Set up environment variables"
echo "3. Verify deployments are working"
echo ""
echo "Admin: https://tinadmin-admin.vercel.app"
echo "Portal: https://tinadmin-portal.vercel.app"
