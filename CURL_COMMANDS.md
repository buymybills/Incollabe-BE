# Quick cURL Commands - Pause vs Cancel

## Setup
```bash
export API_BASE="http://localhost:3002/api"
export AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2NTE5OTk5NywiZXhwIjoxNzY1ODA0Nzk3LCJqdGkiOiIxM2QwY2I3NC1mZTFjLTQzODItOWFkZC04ZjgzZmMwNDJkZGUifQ.wjD80L1vcrKB6m_KL8-fIg94y4XxWNZlJerFqlJ0D4k"
```

**Note:** The API uses `/api` prefix for all routes.

---

## 1. 📊 Get Subscription Status

```bash
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq
```

**What to check:**
- `subscription.status` - Should be "active", "paused", or "cancelled"
- `subscription.isPaused` - Boolean indicating if paused
- `subscription.mandateStatus` - "authenticated", "paused", or "cancelled"
- `subscription.autoRenew` - If autopay is enabled

---

## 2. ⏸️ Pause Subscription (RECOMMENDED)

### Pause for 10 days
```bash
curl -X POST "$API_BASE/influencer/pro/pause" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pauseDurationDays": 10,
    "reason": "Going on vacation"
  }' | jq
```

### Pause for 30 days
```bash
curl -X POST "$API_BASE/influencer/pro/pause" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pauseDurationDays": 30,
    "reason": "Taking a month break"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Subscription will pause after current billing cycle ends on 2025-01-15",
  "details": {
    "currentPeriodEnds": "2025-01-15",
    "pauseStartsOn": "2025-01-15",
    "pauseDurationDays": 10,
    "autoResumeOn": "2025-01-25",
    "nextBillingAfterResume": "2025-01-25"
  }
}
```

**Key Features:**
- ✅ UPI mandate stays active
- ✅ No fresh approval needed to restart
- ✅ Auto-resumes after duration
- ✅ Instant restart capability

---

## 3. ▶️ Resume Subscription

```bash
curl -X POST "$API_BASE/influencer/pro/resume" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Subscription resumed successfully!",
  "subscription": {
    "id": 1,
    "status": "active",
    "currentPeriodStart": "2025-01-20T00:00:00.000Z",
    "currentPeriodEnd": "2025-02-19T00:00:00.000Z",
    "nextBillingDate": "2025-02-19T00:00:00.000Z"
  }
}
```

**Key Features:**
- ✅ Instant reactivation (no UPI app needed)
- ✅ Billing starts immediately
- ✅ No waiting time

---

## 4. ❌ Cancel Autopay (PERMANENT)

### ⚠️ WARNING: This cancels the UPI mandate. Fresh approval required to restart!

```bash
curl -X POST "$API_BASE/influencer/pro/cancel-autopay" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Switching to manual payment"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Autopay cancelled. Your Pro access will remain active until the end of current billing period.",
  "validUntil": "2025-02-15",
  "note": "You can setup autopay again anytime to continue Pro benefits."
}
```

**Key Features:**
- ⚠️ UPI mandate CANCELLED in Razorpay
- ⚠️ Requires fresh UPI app approval to restart
- ⚠️ 2-3 minute setup process to restart
- ✅ Pro access remains until period end
- ✅ RBI compliant

---

## 5. 🔄 Setup UPI Autopay (Fresh Setup)

```bash
curl -X POST "$API_BASE/influencer/pro/setup-upi-autopay" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "message": "UPI Autopay setup initiated. Please approve the mandate in your UPI app.",
  "subscription": {
    "id": 1,
    "razorpaySubscriptionId": "sub_abc123xyz",
    "status": "payment_pending",
    "mandateStatus": "pending"
  },
  "autopayLink": "https://rzp.io/i/abc123",
  "instructions": [
    "1. Click on the autopay link sent to your phone/email",
    "2. Select your preferred UPI app (Google Pay, PhonePe, Paytm, etc.)",
    "3. Approve the autopay mandate in your UPI app",
    "4. First payment will be charged immediately",
    "5. Subsequent payments will be auto-charged every 30 days"
  ]
}
```

---

## 6. 🧪 Test Mode - Activate Subscription (No Payment)

**Only works in development/staging:**

```bash
curl -X POST "$API_BASE/influencer/pro/test-activate" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq
```

---

## 7. 🔍 Test Razorpay Connection

```bash
curl -X GET "$API_BASE/influencer/pro/test-razorpay" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

---

## 8. 📄 Get Invoice Details

```bash
# Replace {invoiceId} with actual invoice ID
curl -X GET "$API_BASE/influencer/pro/invoices/1" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

---

## Testing Flow

### Scenario 1: Test Pause & Resume (RECOMMENDED)

```bash
# 1. Check current status
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# 2. Pause subscription
curl -X POST "$API_BASE/influencer/pro/pause" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pauseDurationDays": 10, "reason": "Testing pause"}' | jq

# 3. Check status again (should show paused)
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# 4. Resume subscription
curl -X POST "$API_BASE/influencer/pro/resume" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# 5. Check final status (should be active again)
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

### Scenario 2: Test Cancel (⚠️ Permanent)

```bash
# 1. Check current status
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# 2. Cancel autopay
curl -X POST "$API_BASE/influencer/pro/cancel-autopay" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing cancel"}' | jq

# 3. Check status (mandateStatus should be "cancelled")
curl -X GET "$API_BASE/influencer/pro/subscription" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# 4. To restart, need fresh setup
curl -X POST "$API_BASE/influencer/pro/setup-upi-autopay" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

---

## Quick Comparison

| Feature | ⏸️ Pause | ❌ Cancel |
|---------|----------|-----------|
| **Mandate** | ✅ Active | ❌ Cancelled |
| **Restart** | ✅ Instant | ⚠️ Fresh approval |
| **Time to restart** | < 1 second | 2-3 minutes |
| **UX** | ✅ Excellent | ⚠️ Friction |
| **Best for** | Temporary | Permanent |

---

## Error Handling

### Common Errors

**No active subscription:**
```json
{
  "statusCode": 404,
  "message": "No active subscription found"
}
```

**Invalid pause duration:**
```json
{
  "statusCode": 400,
  "message": "Pause duration must be between 1 and 365 days"
}
```

**Already paused:**
```json
{
  "statusCode": 400,
  "message": "Subscription is already paused"
}
```

**Not authenticated:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## Tips

1. **Always check status first** to understand current state
2. **Use jq for pretty output** - Install: `brew install jq`
3. **Test pause before cancel** - Easier to reverse
4. **Monitor webhook events** for real-time updates
5. **Check Razorpay dashboard** for mandate status

---

## Next Steps

1. Run the test script: `./CURL_TEST_PAUSE_CANCEL.sh`
2. Or use individual commands above
3. Check the HTML test page: `test-pause-cancel-subscription.html`
4. Read the guide: `UPI_AUTOPAY_PAUSE_VS_CANCEL_GUIDE.md`
