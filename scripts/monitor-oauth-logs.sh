#!/bin/bash

# Monitor OAuth-related logs for Google Sheets integration
# This script helps track OAuth flow and diagnose invalid_client errors

echo "🔍 Google Sheets OAuth Log Monitor"
echo "=================================="
echo ""
echo "Monitoring for OAuth-related activity..."
echo "Press Ctrl+C to stop"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if Next.js dev server is running
check_dev_server() {
    if lsof -ti:3002 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Portal dev server is running on port 3002"
        return 0
    else
        echo -e "${RED}✗${NC} Portal dev server is NOT running on port 3002"
        echo "   Start it with: npm run dev:portal"
        return 1
    fi
}

# Function to monitor network activity on OAuth endpoints
monitor_oauth_endpoints() {
    echo ""
    echo -e "${BLUE}Monitoring OAuth API endpoints:${NC}"
    echo "  - /api/integrations/google-sheets/connect"
    echo "  - /api/integrations/google-sheets/callback"
    echo "  - /api/integrations/google-sheets/auth-url"
    echo ""
    echo "Recent activity (last 10 requests):"
    echo "-----------------------------------"
    
    # Check if we can see recent network activity
    # This is a placeholder - actual monitoring would require access to server logs
    echo "Note: To see real-time logs, check the terminal running 'npm run dev'"
    echo ""
}

# Function to check environment variables
check_env_vars() {
    echo -e "${BLUE}Checking OAuth environment variables:${NC}"
    
    if [ -f .env.local ]; then
        echo "Found .env.local file"
        
        # Check for Google OAuth variables
        if grep -q "GOOGLE_CLIENT_ID" .env.local; then
            CLIENT_ID=$(grep "GOOGLE_CLIENT_ID" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
            if [ ! -z "$CLIENT_ID" ]; then
                echo -e "  ${GREEN}✓${NC} GOOGLE_CLIENT_ID is set (${CLIENT_ID:0:25}...)"
            else
                echo -e "  ${RED}✗${NC} GOOGLE_CLIENT_ID is empty"
            fi
        else
            echo -e "  ${RED}✗${NC} GOOGLE_CLIENT_ID not found"
        fi
        
        if grep -q "GOOGLE_CLIENT_SECRET" .env.local; then
            SECRET=$(grep "GOOGLE_CLIENT_SECRET" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
            if [ ! -z "$SECRET" ]; then
                echo -e "  ${GREEN}✓${NC} GOOGLE_CLIENT_SECRET is set (${SECRET:0:10}...)"
            else
                echo -e "  ${RED}✗${NC} GOOGLE_CLIENT_SECRET is empty"
            fi
        else
            echo -e "  ${RED}✗${NC} GOOGLE_CLIENT_SECRET not found"
        fi
        
        if grep -q "GOOGLE_SHEETS_REDIRECT_URI" .env.local; then
            REDIRECT_URI=$(grep "GOOGLE_SHEETS_REDIRECT_URI" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
            if [ ! -z "$REDIRECT_URI" ]; then
                echo -e "  ${GREEN}✓${NC} GOOGLE_SHEETS_REDIRECT_URI is set"
                echo "      Value: $REDIRECT_URI"
            else
                echo -e "  ${YELLOW}⚠${NC} GOOGLE_SHEETS_REDIRECT_URI is empty (will use computed value)"
            fi
        else
            echo -e "  ${YELLOW}⚠${NC} GOOGLE_SHEETS_REDIRECT_URI not found (will use computed value)"
        fi
    else
        echo -e "  ${RED}✗${NC} .env.local file not found"
    fi
    echo ""
}

# Function to show expected redirect URI
show_redirect_uri() {
    echo -e "${BLUE}Expected Redirect URI:${NC}"
    echo "  http://localhost:3002/api/integrations/google-sheets/callback"
    echo ""
    echo -e "${YELLOW}⚠ Important:${NC} This exact URI must be added to Google Cloud Console"
    echo "  Go to: https://console.cloud.google.com/apis/credentials"
    echo "  Find your OAuth 2.0 Client ID"
    echo "  Add to 'Authorized redirect URIs'"
    echo ""
}

# Function to show common error patterns to watch for
show_error_patterns() {
    echo -e "${BLUE}Common OAuth Error Patterns to Watch:${NC}"
    echo ""
    echo "1. ${RED}invalid_client${NC}"
    echo "   - Client ID doesn't exist or is incorrect"
    echo "   - Redirect URI doesn't match Google Cloud Console"
    echo "   - Client Secret is wrong"
    echo ""
    echo "2. ${RED}redirect_uri_mismatch${NC}"
    echo "   - Redirect URI not authorized in Google Cloud Console"
    echo "   - Check for trailing slashes or extra characters"
    echo ""
    echo "3. ${RED}invalid_request${NC}"
    echo "   - OAuth request parameters are invalid"
    echo "   - Usually related to redirect URI configuration"
    echo ""
    echo "4. ${RED}access_denied${NC}"
    echo "   - User denied permissions"
    echo "   - Not a configuration error"
    echo ""
}

# Function to provide monitoring instructions
show_monitoring_instructions() {
    echo -e "${BLUE}How to Monitor Real-Time Logs:${NC}"
    echo ""
    echo "1. In the terminal running 'npm run dev', watch for:"
    echo "   - [Google Sheets OAuth] messages"
    echo "   - [DEBUG] messages"
    echo "   - OAuth configuration logs"
    echo "   - Error messages"
    echo ""
    echo "2. In browser DevTools (F12):"
    echo "   - Network tab: Watch for /api/integrations/google-sheets/* requests"
    echo "   - Console tab: Check for JavaScript errors"
    echo ""
    echo "3. Key log messages to watch for:"
    echo "   - 'OAuth URL generated'"
    echo "   - 'OAuth callback received'"
    echo "   - 'OAuth token exchange configuration'"
    echo "   - 'Failed to exchange authorization code'"
    echo "   - 'OAuth error from Google'"
    echo ""
}

# Main execution
main() {
    check_dev_server
    check_env_vars
    show_redirect_uri
    show_error_patterns
    show_monitoring_instructions
    
    echo ""
    echo -e "${GREEN}Monitoring setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Ensure dev server is running: npm run dev:portal"
    echo "2. Watch the dev server terminal for OAuth logs"
    echo "3. Test OAuth flow at: http://localhost:3002/dashboard/integrations/google-sheets"
    echo "4. Check browser console and network tabs for errors"
    echo ""
}

# Run main function
main



