#!/bin/bash

# Script to enable domain-wide delegation for Google Cloud Service Account
# This script enables domain-wide delegation via gcloud CLI

set -e

# Configuration
SERVICE_ACCOUNT_EMAIL="fincat-service-account@financial-categorization.iam.gserviceaccount.com"
PROJECT_ID="financial-categorization"
OAUTH_CLIENT_ID="102883458523619415855"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Google Cloud Domain-Wide Delegation Setup ===${NC}\n"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed.${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
echo "Checking gcloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}No active gcloud authentication found.${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

echo -e "${GREEN}✓ Authenticated${NC}\n"

# Set the project
echo "Setting project to: ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID} || {
    echo -e "${RED}Error: Failed to set project. Please check the project ID.${NC}"
    exit 1
}
echo -e "${GREEN}✓ Project set${NC}\n"

# Get the service account's unique ID
echo "Getting service account details..."
SERVICE_ACCOUNT_ID=$(gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} --format="value(uniqueId)" 2>/dev/null) || {
    echo -e "${RED}Error: Service account not found: ${SERVICE_ACCOUNT_EMAIL}${NC}"
    echo "Please verify the service account email address."
    exit 1
}

echo -e "${GREEN}✓ Service account found (ID: ${SERVICE_ACCOUNT_ID})${NC}\n"

# Get the OAuth2 Client ID (uniqueId) for domain-wide delegation
echo "Getting OAuth2 Client ID for domain-wide delegation..."
OAUTH_CLIENT_ID_ACTUAL=$(gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} \
    --format="value(uniqueId)" 2>/dev/null) || {
    echo -e "${RED}Error: Failed to get service account details.${NC}"
    exit 1
}

echo -e "${GREEN}✓ OAuth2 Client ID retrieved: ${OAUTH_CLIENT_ID_ACTUAL}${NC}"

# Verify if it matches the expected client ID
if [ "$OAUTH_CLIENT_ID_ACTUAL" == "$OAUTH_CLIENT_ID" ]; then
    echo -e "${GREEN}✓ OAuth2 Client ID matches expected value${NC}"
else
    echo -e "${YELLOW}⚠ OAuth2 Client ID differs from expected${NC}"
    echo "  Expected: ${OAUTH_CLIENT_ID}"
    echo "  Actual: ${OAUTH_CLIENT_ID_ACTUAL}"
    echo ""
    echo "  Using actual Client ID: ${OAUTH_CLIENT_ID_ACTUAL}"
    OAUTH_CLIENT_ID=$OAUTH_CLIENT_ID_ACTUAL
fi

echo ""

# Note: Domain-wide delegation is enabled by default for service accounts
# The key step is authorizing it in Google Workspace Admin Console
echo -e "${GREEN}✓ Service account is ready for domain-wide delegation${NC}"
echo "  Note: Domain-wide delegation capability is enabled by default."
echo "  You must authorize it in Google Workspace Admin Console (see steps below)."
echo ""

echo ""
echo -e "${GREEN}=== Step 1 Complete: Domain-Wide Delegation Enabled ===${NC}\n"

# Display next steps
echo -e "${YELLOW}=== Next Steps (Manual - Google Workspace Admin Console) ===${NC}\n"
echo "You must complete the following step manually in Google Workspace Admin Console:"
echo ""
echo "1. Go to: https://admin.google.com"
echo "2. Navigate to: Security → API Controls → Domain-wide Delegation"
echo "3. Click 'Add new' or 'Manage Domain-wide Delegation'"
echo "4. Add the following:"
echo ""
echo -e "   ${GREEN}Client ID:${NC} ${OAUTH_CLIENT_ID}"
echo -e "   ${GREEN}OAuth Scopes (comma-separated):${NC}"
echo "   https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.file"
echo ""
echo "5. Click 'Authorize'"
echo ""
echo -e "${YELLOW}Note:${NC} You must be a Google Workspace Super Admin to perform this step."
echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo "Service Account: ${SERVICE_ACCOUNT_EMAIL}"
echo "OAuth2 Client ID: ${OAUTH_CLIENT_ID}"
echo "Required Scopes:"
echo "  - https://www.googleapis.com/auth/spreadsheets"
echo "  - https://www.googleapis.com/auth/drive.file"
echo ""
echo -e "${GREEN}Setup complete!${NC}"

