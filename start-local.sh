#!/bin/bash
# Quick start script for local Supabase development

echo "🚀 Starting local Supabase development..."

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start Supabase
echo "📦 Starting Supabase services..."
supabase start

echo ""
echo "✅ Supabase is running!"
echo ""
echo "📝 Next steps:"
echo "1. Copy the 'anon key' from above"
echo "2. Update .env.local with:"
echo "   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321"
echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>"
echo "3. Run: npm run dev"
echo ""
echo "🌐 Access Supabase Studio at: http://localhost:54323"
