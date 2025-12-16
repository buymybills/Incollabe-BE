#!/bin/bash

# Quick Test Script - Pause vs Cancel
# Note: API uses /api prefix

API_BASE="http://localhost:3002/api"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2NTE5OTk5NywiZXhwIjoxNzY1ODA0Nzk3LCJqdGkiOiIxM2QwY2I3NC1mZTFjLTQzODItOWFkZC04ZjgzZmMwNDJkZGUifQ.wjD80L1vcrKB6m_KL8-fIg94y4XxWNZlJerFqlJ0D4k"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 STEP 1: Check Current Subscription Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -s | jq '.'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 STEP 2: Setup UPI Autopay (if not already set up)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Note: This creates a Razorpay subscription and sends UPI autopay link"
echo ""
curl -X POST "$API_BASE/influencer/pro/setup-upi-autopay" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -s | jq '.'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏸️  STEP 3: PAUSE Subscription (Recommended)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Features:"
echo "  ✅ UPI mandate stays active"
echo "  ✅ Easy restart with no fresh approval"
echo "  ✅ Auto-resumes after 10 days"
echo ""
read -p "Press Enter to pause subscription (or Ctrl+C to skip)..."
curl -X POST "$API_BASE/influencer/pro/pause" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pauseDurationDays": 10, "reason": "Testing pause functionality"}' \
  -s | jq '.'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 STEP 4: Check Status After Pause"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -s | jq '.data.subscription | {id, status, isPaused, mandateStatus: .upiMandateStatus, autoRenew}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶️  STEP 5: RESUME Subscription"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Features:"
echo "  ✅ Instant reactivation"
echo "  ✅ No UPI authentication needed"
echo ""
read -p "Press Enter to resume subscription (or Ctrl+C to skip)..."
curl -X POST "$API_BASE/influencer/pro/resume" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -s | jq '.'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 STEP 6: Check Status After Resume"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -s | jq '.data.subscription | {id, status, isPaused, mandateStatus: .upiMandateStatus, autoRenew}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❌ STEP 7: CANCEL Autopay (Optional - Permanent)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  WARNING: This will cancel the UPI mandate!"
echo "⚠️  You will need fresh approval to restart"
echo ""
read -p "Press Enter to cancel autopay (or Ctrl+C to skip)..."
curl -X POST "$API_BASE/influencer/pro/cancel-autopay" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing cancel functionality"}' \
  -s | jq '.'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Testing Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
