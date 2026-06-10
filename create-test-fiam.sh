#!/bin/bash

# ============================================================================
# Test FIAM Campaign Creator
# This creates a simple test campaign that broadcasts immediately
# ============================================================================

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Error: ADMIN_TOKEN environment variable not set"
  echo "Usage: ADMIN_TOKEN='your-admin-jwt-token' ./create-test-fiam.sh"
  exit 1
fi

echo "🚀 Creating test FIAM campaign..."
echo "API Base URL: $API_BASE_URL"
echo ""

# Get current time for scheduledAt
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create campaign
RESPONSE=$(curl -X POST "$API_BASE_URL/admin/fiam-campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Test FIAM Notification",
    "internalName": "Test - Immediate Broadcast",
    "description": "Simple test campaign for immediate delivery",
    "priority": 100,
    "uiConfig": {
      "layoutType": "card",
      "backgroundColor": "#FF5722",
      "textColor": "#FFFFFF",
      "title": "🔥 Test Notification",
      "body": "This is a test FIAM notification sent at '"$CURRENT_TIME"'",
      "buttonConfig": {
        "text": "Got it!",
        "actionUrl": "app://home",
        "backgroundColor": "#FFFFFF",
        "textColor": "#FF5722"
      }
    },
    "triggerType": "scheduled",
    "scheduledAt": "'"$CURRENT_TIME"'",
    "targetUserTypes": ["influencer"],
    "targetIsPanIndia": true,
    "status": "draft"
  }' \
  -s -w "\n")

echo "✅ Campaign created:"
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"

# Extract campaign ID
CAMPAIGN_ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)

if [ -z "$CAMPAIGN_ID" ] || [ "$CAMPAIGN_ID" = "null" ]; then
  echo ""
  echo "❌ Failed to extract campaign ID. Check the response above."
  exit 1
fi

echo ""
echo "📋 Campaign ID: $CAMPAIGN_ID"
echo ""
echo "🎯 Activating campaign..."

# Activate campaign
ACTIVATE_RESPONSE=$(curl -X PATCH "$API_BASE_URL/admin/fiam-campaigns/$CAMPAIGN_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "status": "active"
  }' \
  -s -w "\n")

echo "$ACTIVATE_RESPONSE" | jq '.' || echo "$ACTIVATE_RESPONSE"

echo ""
echo "📢 Broadcasting campaign..."

# Broadcast campaign
BROADCAST_RESPONSE=$(curl -X POST "$API_BASE_URL/admin/fiam-campaigns/$CAMPAIGN_ID/broadcast" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -s -w "\n")

echo "$BROADCAST_RESPONSE" | jq '.' || echo "$BROADCAST_RESPONSE"

echo ""
echo "✨ Done! Check your device for the notification."
echo ""
echo "📊 To view campaign analytics:"
echo "curl -X GET '$API_BASE_URL/admin/fiam-campaigns/$CAMPAIGN_ID/analytics' \\"
echo "  -H 'Authorization: Bearer \$ADMIN_TOKEN' | jq '.'"
