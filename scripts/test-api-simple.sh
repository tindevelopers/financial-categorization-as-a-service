#!/bin/bash
# Simple test script for categorization API
# This demonstrates how to test the API endpoints

API_BASE_URL="${API_BASE_URL:-http://localhost:3002}"

echo "🧪 Testing Categorization API Endpoints"
echo "API Base URL: $API_BASE_URL"
echo ""

# Test 1: Unauthenticated request
echo "📝 Test 1: Unauthenticated request to /api/categorization/jobs"
echo "Expected: 401 Unauthorized"
echo ""

response=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/api/categorization/jobs" \
  -H "Content-Type: application/json" \
  --cookie-jar /dev/null \
  --cookie /dev/null)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo "Response: $body"
echo ""

if [ "$http_code" = "401" ]; then
  echo "✅ Test 1 PASSED: Correctly returned 401 Unauthorized"
else
  echo "⚠️  Test 1: Got $http_code instead of 401"
  echo "   This might indicate the endpoint allows unauthenticated access"
fi

echo ""
echo "📝 Test 2: To test authenticated requests, you need to:"
echo "   1. Sign in through the web interface"
echo "   2. Copy the authentication cookies from your browser"
echo "   3. Use those cookies in your requests"
echo ""
echo "Example with cookies:"
echo "  curl -X GET '${API_BASE_URL}/api/categorization/jobs' \\"
echo "    -H 'Cookie: sb-<project-ref>-auth-token=<your-token>'"
echo ""

