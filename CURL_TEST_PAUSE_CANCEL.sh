#!/bin/bash

# ==============================================================================
# UPI Autopay Pause vs Cancel - cURL Testing Script
# ==============================================================================

# Configuration
API_BASE="http://localhost:3002/api"  # Note: API uses /api prefix
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2NTE5OTk5NywiZXhwIjoxNzY1ODA0Nzk3LCJqdGkiOiIxM2QwY2I3NC1mZTFjLTQzODItOWFkZC04ZjgzZmMwNDJkZGUifQ.wjD80L1vcrKB6m_KL8-fIg94y4XxWNZlJerFqlJ0D4k"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  UPI Autopay Pause vs Cancel - cURL Testing                 ║${NC}"
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo ""

# ==============================================================================
# 1. GET SUBSCRIPTION STATUS
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}1. GET SUBSCRIPTION STATUS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Command:"
echo "curl -X GET '$API_BASE/influencer/pro/subscription' \\"
echo "  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2NTE5OTk5NywiZXhwIjoxNzY1ODA0Nzk3LCJqdGkiOiIxM2QwY2I3NC1mZTFjLTQzODItOWFkZC04ZjgzZmMwNDJkZGUifQ.wjD80L1vcrKB6m_KL8-fIg94y4XxWNZlJerFqlJ0D4k' \\"
echo "  -H 'Content-Type: application/json'"
echo ""
echo "Response:"
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -s | jq '.'
echo ""
echo ""

# ==============================================================================
# 2. SETUP UPI AUTOPAY (if not already set up)
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}2. SETUP UPI AUTOPAY (Optional - only if needed)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Command:"
echo "curl -X POST '$API_BASE/influencer/pro/setup-upi-autopay' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json'"
echo ""
echo "Uncomment below to run:"
echo "# Response:"
# curl -X POST "$API_BASE/influencer/pro/setup-upi-autopay" \
#   -H "Authorization: Bearer $AUTH_TOKEN" \
#   -H "Content-Type: application/json" \
#   -s | jq '.'
echo ""
echo ""

# ==============================================================================
# 3. PAUSE SUBSCRIPTION ⏸️ (RECOMMENDED)
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}3. ⏸️  PAUSE SUBSCRIPTION (RECOMMENDED)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Features:${NC}"
echo "  ✅ Keeps UPI mandate active"
echo "  ✅ Easy instant restart with no fresh approval"
echo "  ✅ Auto-resumes after specified duration"
echo "  ✅ Best for temporary breaks, vacations, budget constraints"
echo ""
echo "Command:"
echo "curl -X POST '$API_BASE/influencer/pro/pause' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"pauseDurationDays\": 10,"
echo "    \"reason\": \"Going on vacation\""
echo "  }'"
echo ""
echo "Response:"
curl -X POST "$API_BASE/influencer/pro/pause" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pauseDurationDays": 10,
    "reason": "Going on vacation"
  }' \
  -s | jq '.'
echo ""
echo ""

# ==============================================================================
# 4. RESUME SUBSCRIPTION ▶️
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}4. ▶️  RESUME SUBSCRIPTION${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Features:${NC}"
echo "  ✅ Instant reactivation (no UPI authentication needed)"
echo "  ✅ Billing starts immediately"
echo "  ✅ No friction, no waiting"
echo ""
echo "Command:"
echo "curl -X POST '$API_BASE/influencer/pro/resume' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json'"
echo ""
echo "Uncomment below to test resume:"
echo "# Response:"
# curl -X POST "$API_BASE/influencer/pro/resume" \
#   -H "Authorization: Bearer $AUTH_TOKEN" \
#   -H "Content-Type: application/json" \
#   -s | jq '.'
echo ""
echo ""

# ==============================================================================
# 5. CANCEL AUTOPAY ❌ (PERMANENT)
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}5. ❌ CANCEL AUTOPAY (PERMANENT - Requires fresh approval)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${RED}Warning:${NC}"
echo "  ⚠️  UPI mandate will be CANCELLED in Razorpay"
echo "  ⚠️  Requires FRESH APPROVAL to restart (as per RBI regulations)"
echo "  ⚠️  User must re-authenticate mandate in UPI app"
echo "  ✅ Pro access remains until end of current billing period"
echo ""
echo -e "${BLUE}Use this when:${NC}"
echo "  • Permanently stopping subscription"
echo "  • Switching to manual payments"
echo "  • Compliance/security requirements"
echo ""
echo "Command:"
echo "curl -X POST '$API_BASE/influencer/pro/cancel-autopay' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"reason\": \"Switching to manual payment\""
echo "  }'"
echo ""
echo "Uncomment below to test cancel (WARNING: Permanent!):"
echo "# Response:"
# curl -X POST "$API_BASE/influencer/pro/cancel-autopay" \
#   -H "Authorization: Bearer $AUTH_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "reason": "Switching to manual payment"
#   }' \
#   -s | jq '.'
echo ""
echo ""

# ==============================================================================
# COMPARISON TABLE
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 PAUSE vs CANCEL COMPARISON${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
printf "%-20s | %-25s | %-25s\n" "Feature" "⏸️  PAUSE" "❌ CANCEL"
echo "────────────────────────────────────────────────────────────────────"
printf "%-20s | %-25s | %-25s\n" "Mandate Status" "✅ Stays Active" "❌ Cancelled"
printf "%-20s | %-25s | %-25s\n" "Restart Process" "✅ Instant (1 click)" "⚠️  Fresh Approval"
printf "%-20s | %-25s | %-25s\n" "UX Friction" "✅ None" "⚠️  2-3 minutes"
printf "%-20s | %-25s | %-25s\n" "Auto Resume" "✅ Yes (configurable)" "❌ No"
printf "%-20s | %-25s | %-25s\n" "Compliance" "✅ RBI Approved" "✅ RBI Required"
printf "%-20s | %-25s | %-25s\n" "Best For" "Temporary breaks" "Permanent stop"
echo ""
echo ""

# ==============================================================================
# ADDITIONAL USEFUL COMMANDS
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📝 ADDITIONAL USEFUL COMMANDS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "6. Get Invoice Details:"
echo "curl -X GET '$API_BASE/influencer/pro/invoices/{invoiceId}' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN'"
echo ""

echo "7. Test Razorpay Connection:"
echo "curl -X GET '$API_BASE/influencer/pro/test-razorpay' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN'"
echo ""

echo "8. Activate Test Subscription (TEST MODE ONLY):"
echo "curl -X POST '$API_BASE/influencer/pro/test-activate' \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN'"
echo ""
echo ""

# ==============================================================================
# RECOMMENDATIONS
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}💡 RECOMMENDATIONS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. ✅ Default to PAUSE for better UX and retention"
echo "2. ⚠️  Show CANCEL as secondary option with strong warning"
echo "3. 💡 Educate users about the difference in your UI"
echo "4. 📊 Track metrics: pause → resume rate vs cancel → never return rate"
echo "5. 🎯 Consider offering pause durations: 7, 14, 30, 60 days"
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testing Complete! Check responses above.                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
