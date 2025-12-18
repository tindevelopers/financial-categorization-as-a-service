#!/bin/bash

# Comprehensive localhost deployment script with Docker-based Supabase
# This script will:
# 1. Check Docker is running
# 2. Start Supabase (which uses Docker containers)
# 3. Extract and configure environment variables
# 4. Start Next.js development server

set -e  # Exit on error

echo "🚀 Starting localhost deployment with Docker-based Supabase..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check if Docker is running
print_info "Checking Docker status..."
if ! docker ps > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop first."
    exit 1
fi
print_success "Docker is running"

# Step 2: Check if Supabase CLI is installed
print_info "Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed."
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi
print_success "Supabase CLI is installed"

# Step 3: Start Supabase (this uses Docker containers)
print_info "Starting Supabase services (this will start Docker containers)..."
if supabase start > /dev/null 2>&1; then
    print_success "Supabase services started"
else
    print_warning "Supabase may already be running or encountered an issue"
fi

# Step 4: Get Supabase status and extract credentials
print_info "Retrieving Supabase credentials..."
SUPABASE_STATUS=$(supabase status --output json 2>/dev/null || supabase status)

# Try to parse JSON first (most reliable)
if command -v jq &> /dev/null && echo "$SUPABASE_STATUS" | jq . > /dev/null 2>&1; then
    API_URL=$(echo "$SUPABASE_STATUS" | jq -r '.APIUrl // "http://localhost:54321"')
    DB_URL=$(echo "$SUPABASE_STATUS" | jq -r '.DBUrl // "postgresql://postgres:postgres@localhost:54322/postgres"')
    STUDIO_URL=$(echo "$SUPABASE_STATUS" | jq -r '.StudioURL // "http://localhost:54323"')
    ANON_KEY=$(echo "$SUPABASE_STATUS" | jq -r '.anonKey // ""')
    SERVICE_ROLE_KEY=$(echo "$SUPABASE_STATUS" | jq -r '.serviceRoleKey // ""')
else
    # Fallback: Extract from text output using sed (macOS compatible)
    API_URL=$(echo "$SUPABASE_STATUS" | grep "API URL:" | sed -E 's/.*API URL:[[:space:]]+([^[:space:]]+).*/\1/' || echo "http://localhost:54321")
    DB_URL=$(echo "$SUPABASE_STATUS" | grep "DB URL:" | sed -E 's/.*DB URL:[[:space:]]+([^[:space:]]+).*/\1/' || echo "postgresql://postgres:postgres@localhost:54322/postgres")
    STUDIO_URL=$(echo "$SUPABASE_STATUS" | grep "Studio URL:" | sed -E 's/.*Studio URL:[[:space:]]+([^[:space:]]+).*/\1/' || echo "http://localhost:54323")
    ANON_KEY=$(echo "$SUPABASE_STATUS" | grep "anon key:" | sed -E 's/.*anon key:[[:space:]]+([^[:space:]]+).*/\1/' || echo "")
    SERVICE_ROLE_KEY=$(echo "$SUPABASE_STATUS" | grep "service_role key:" | sed -E 's/.*service_role key:[[:space:]]+([^[:space:]]+).*/\1/' || echo "")
fi

# Fallback to default local Supabase keys if not found
if [ -z "$ANON_KEY" ]; then
    print_warning "Could not extract anon key, using default local Supabase key"
    ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    print_warning "Could not extract service role key, using default local Supabase key"
    SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
fi

# Step 5: Create or update .env.local
print_info "Configuring environment variables..."
ENV_FILE=".env.local"

# Create .env.local if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    print_info "Creating $ENV_FILE..."
    touch "$ENV_FILE"
fi

# Update or add environment variables
update_env_var() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$ENV_FILE"; then
        # Update existing variable
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        else
            # Linux
            sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        fi
    else
        # Add new variable
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

update_env_var "NEXT_PUBLIC_SUPABASE_URL" "$API_URL"
update_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"
update_env_var "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"

print_success "Environment variables configured in $ENV_FILE"

# Step 6: Display status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Supabase is running in Docker containers!"
echo ""
print_info "Service URLs:"
echo "  📡 API URL:      $API_URL"
echo "  🗄️  Database URL:  $DB_URL"
echo "  🎨 Studio URL:    $STUDIO_URL"
echo "  📧 Inbucket URL:  http://localhost:54324 (Email testing)"
echo ""
print_info "Environment variables have been configured in .env.local"
echo ""
print_info "Docker containers running:"
docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker ps | grep supabase || echo "  (Use 'docker ps' to see all containers)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 7: Ask if user wants to start Next.js
echo ""
read -p "🚀 Start Next.js development server? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting Next.js development server..."
    echo ""
    npm run dev
else
    echo ""
    print_info "To start Next.js manually, run:"
    echo "  npm run dev"
    echo ""
    print_info "Then visit: http://localhost:3000"
fi

