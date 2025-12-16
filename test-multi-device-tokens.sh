#!/bin/bash

# Test script to verify multi-device push notification setup
# Replace these values with actual test data from your database

API_URL="http://localhost:3000"  # Change to your API URL
USER_ID=1  # Replace with actual influencer ID

echo "🧪 Testing Multi-Device Push Notification Setup"
echo "================================================"

echo ""
echo "📱 Step 1: Adding Device Token for Phone"
curl -X POST "${API_URL}/auth/influencer/update-fcm-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": '${USER_ID}',
    "fcmToken": "test-phone-token-123",
    "deviceId": "device-phone-001",
    "deviceName": "iPhone 14 Pro",
    "deviceOs": "ios",
    "appVersion": "1.0.0"
  }'

echo ""
echo ""
echo "💻 Step 2: Adding Device Token for Tablet"
curl -X POST "${API_URL}/auth/influencer/update-fcm-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": '${USER_ID}',
    "fcmToken": "test-tablet-token-456",
    "deviceId": "device-tablet-001",
    "deviceName": "iPad Pro",
    "deviceOs": "ios",
    "appVersion": "1.0.0"
  }'

echo ""
echo ""
echo "✅ Step 3: Check database for tokens"
echo "Run this SQL query:"
echo "SELECT user_id, user_type, device_name, device_os, LEFT(fcm_token, 20) as token_preview, created_at FROM device_tokens WHERE user_id = ${USER_ID};"

echo ""
echo "================================================"
echo "✨ Test complete! Check the console logs for:"
echo "   - 🆕 Added new FCM token messages"
echo "   - Device count (should show 2/5 devices)"
