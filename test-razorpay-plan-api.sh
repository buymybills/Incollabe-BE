#!/bin/bash

# Test Razorpay Plans API directly
# This will help us understand if the API is available for your account

source .env

echo "Testing Razorpay Plans API..."
echo "Using Key ID: $RAZORPAY_KEY_ID"
echo ""

# Create plan using Razorpay API
curl -X POST https://api.razorpay.com/v1/plans \
  -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "monthly",
    "interval": 1,
    "item": {
      "name": "Pro Influencer Monthly Subscription",
      "description": "Monthly subscription for Pro Influencer features",
      "amount": 19900,
      "currency": "INR"
    },
    "notes": {
      "description": "Pro account subscription with auto-renewal"
    }
  }'

echo ""
echo ""
echo "If you see a plan ID above, copy it to your .env file"
echo "If you see an error, please create the plan manually in Razorpay Dashboard"
