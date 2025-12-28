#!/bin/bash

echo "=========================================="
echo "MCP Configuration Analysis & Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MCP_CONFIG="$HOME/.cursor/mcp.json"

echo "1. Checking MCP configuration file..."
if [ ! -f "$MCP_CONFIG" ]; then
    echo -e "${RED}✗ MCP config file not found at $MCP_CONFIG${NC}"
    exit 1
fi
echo -e "${GREEN}✓ MCP config file exists${NC}"

# Validate JSON
if python3 -m json.tool "$MCP_CONFIG" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ JSON syntax is valid${NC}"
else
    echo -e "${RED}✗ JSON syntax is invalid${NC}"
    exit 1
fi

echo ""
echo "2. Checking required executables..."
REQUIRED_CMDS=("npx" "python3")
for cmd in "${REQUIRED_CMDS[@]}"; do
    if command -v "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $cmd found${NC}"
    else
        echo -e "${RED}✗ $cmd not found${NC}"
    fi
done

if [ -f "/Users/gene/.local/bin/uvx" ]; then
    echo -e "${GREEN}✓ uvx found${NC}"
else
    echo -e "${YELLOW}⚠ uvx not found (needed for AWS MCP)${NC}"
fi

echo ""
echo "3. Checking file paths..."
if [ -f "$HOME/.config/gcloud/application_default_credentials.json" ]; then
    echo -e "${GREEN}✓ Google credentials file exists${NC}"
else
    echo -e "${RED}✗ Google credentials file missing${NC}"
fi

if [ -d "/Users/gene/Library/CloudStorage/OneDrive-TheInformationNetworkLtd/AI (Artificial Intelligence) - Media library" ]; then
    echo -e "${GREEN}✓ Stability AI storage directory exists${NC}"
else
    echo -e "${YELLOW}⚠ Stability AI storage directory missing${NC}"
fi

echo ""
echo "4. Testing MCP server packages..."
echo ""

# Extract server names and packages from config
declare -a SERVERS=(
    "stability-ai:mcp-server-stability-ai"
    "notion:@notionhq/notion-mcp-server"
    "dataforseo:dataforseo-mcp-server"
    "github:@modelcontextprotocol/server-github"
    "cloud-run:@google-cloud/cloud-run-mcp"
    "gcloud:@google-cloud/gcloud-mcp"
    "observability:@google-cloud/observability-mcp"
    "shopify:@shopify/dev-mcp"
    "google-search:@kyaniiii/google-search-mcp"
    "google-sheets:google-sheets-mcp"
)

for server_info in "${SERVERS[@]}"; do
    IFS=':' read -r name package <<< "$server_info"
    echo -n "Testing $name ($package)... "
    
    if npm view "$package" version > /dev/null 2>&1; then
        version=$(npm view "$package" version 2>/dev/null | head -1)
        echo -e "${GREEN}✓ Available (v$version)${NC}"
    else
        echo -e "${RED}✗ Package not found${NC}"
    fi
done

echo ""
echo "5. Checking for empty environment variables..."
if grep -q '"GOOGLE_API_KEY": ""' "$MCP_CONFIG"; then
    echo -e "${YELLOW}⚠ google-search has empty GOOGLE_API_KEY${NC}"
fi
if grep -q '"GOOGLE_SEARCH_ENGINE_ID": ""' "$MCP_CONFIG"; then
    echo -e "${YELLOW}⚠ google-search has empty GOOGLE_SEARCH_ENGINE_ID${NC}"
fi

echo ""
echo "6. Summary of issues found:"
echo ""

ISSUES=0

# Check for non-existent packages
if ! npm view "google-sheets-mcp" version > /dev/null 2>&1; then
    echo -e "${RED}✗ google-sheets: Package google-sheets-mcp does not exist${NC}"
    ISSUES=$((ISSUES + 1))
fi

# Check for empty API keys
if grep -q '"GOOGLE_API_KEY": ""' "$MCP_CONFIG"; then
    echo -e "${YELLOW}⚠ google-search: GOOGLE_API_KEY is empty (optional, but needed for functionality)${NC}"
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ No critical issues found${NC}"
else
    echo -e "${RED}Found $ISSUES critical issue(s)${NC}"
fi

echo ""
echo "=========================================="
echo "Analysis complete"
echo "=========================================="

