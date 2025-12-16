#!/bin/bash

# Check if Subscriptions feature is enabled
source .env

echo "🔍 Checking Razorpay Subscriptions access..."
echo "Using: $RAZORPAY_KEY_ID"
echo ""

# Try to list plans (if this works, subscriptions are enabled)
response=$(curl -s -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" \
  https://api.razorpay.com/v1/plans)

if echo "$response" | grep -q "items"; then
  echo "✅ Subscriptions feature is ENABLED!"
  echo ""
  echo "Existing plans:"
  echo "$response" | jq -r '.items[] | "  - \(.id): \(.item.name) (₹\(.item.amount/100))"' 2>/dev/null || echo "  No plans found"
  echo ""
  echo "You can create plans via dashboard: https://dashboard.razorpay.com/app/subscriptions/plans"
elif echo "$response" | grep -q "not found"; then
  echo "❌ Subscriptions feature is NOT ENABLED"
  echo ""
  echo "To enable:"
  echo "1. Go to https://dashboard.razorpay.com/app/settings"
  echo "2. Contact Razorpay support to enable Subscriptions"
  echo "3. Or email: support@razorpay.com"
else
  echo "⚠️  Unknown response:"
  echo "$response" | jq . 2>/dev/null || echo "$response"
fi
