# UPI Autopay Subscription System - Complete Implementation Guide

## Overview

This guide covers the comprehensive UPI Autopay subscription system with pause/resume functionality for the Pro subscription feature.

## Features Implemented

✅ **UPI Autopay Setup**
- Send payment link to user's UPI app (Google Pay, PhonePe, Paytm, etc.)
- User approves mandate in their UPI app
- First payment charged immediately
- Automatic recurring payments every 30 days

✅ **Pause Functionality**
- User specifies pause duration (1-365 days)
- Current billing cycle completes before pause
- Auto-resume after pause period
- Billing cycle adjusts based on resume date

✅ **Cancel Autopay**
- Stops automatic payments from next cycle
- Pro access remains until current period ends
- User can setup autopay again anytime

✅ **Webhook Integration**
- Handles subscription events (activated, charged, paused, resumed, cancelled)
- Handles payment events (captured, failed, authorized)
- Automatic invoice generation for recurring charges

✅ **Cron Jobs**
- Auto-resume paused subscriptions (runs hourly)
- Expire subscriptions (runs daily at 1 AM)

---

## Database Schema Changes

### Migration File

Run this migration to add UPI autopay and pause/resume fields:

```bash
psql -d your_database < migrations/add_upi_autopay_pause_fields.sql
```

### New Fields in `pro_subscriptions` Table

**UPI Autopay Fields:**
- `upi_mandate_id` - Razorpay UPI mandate/token ID
- `upi_mandate_status` - Status: not_created, pending, authenticated, paused, cancelled, rejected, revoked
- `mandate_created_at` - Timestamp when mandate was created
- `mandate_authenticated_at` - Timestamp when user approved mandate
- `mandate_max_amount` - Maximum amount for autopay (in paise)

**Pause/Resume Fields:**
- `is_paused` - Boolean flag for pause status
- `paused_at` - Timestamp when paused
- `pause_duration_days` - Number of days to pause
- `resume_date` - Calculated auto-resume date
- `pause_reason` - User-provided reason

**Tracking Fields:**
- `pause_count` - Number of times paused
- `total_paused_days` - Total accumulated paused days
- `last_auto_charge_attempt` - Last autopay attempt
- `auto_charge_failures` - Consecutive failure count

---

## Environment Variables

Add these to your `.env` file:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_ACCOUNT_NUMBER=your_account_number # For payouts

# Payment Callback
PAYMENT_CALLBACK_URL=https://yourdomain.com/payment-success

# Node Environment
NODE_ENV=production # or development/staging
```

---

## API Endpoints

### 1. Setup UPI Autopay

**Endpoint:** `POST /influencer/pro/setup-upi-autopay`

**Description:** Initiates UPI autopay setup for Pro subscription.

**Headers:**
```
Authorization: Bearer <influencer_token>
```

**Response:**
```json
{
  "success": true,
  "message": "UPI Autopay setup initiated. Please approve the mandate in your UPI app.",
  "subscription": {
    "id": 1,
    "razorpaySubscriptionId": "sub_abc123",
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

**Flow:**
1. Creates Razorpay subscription plan (if not exists)
2. Creates Razorpay subscription with UPI autopay
3. Sends payment link to user's phone/email
4. User approves in UPI app
5. First payment charged immediately
6. Webhook activates subscription

---

### 2. Pause Subscription

**Endpoint:** `POST /influencer/pro/pause`

**Description:** Pauses subscription for specified days after current cycle ends.

**Headers:**
```
Authorization: Bearer <influencer_token>
```

**Request Body:**
```json
{
  "pauseDurationDays": 10,
  "reason": "Going on vacation" // optional
}
```

**Response:**
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

**Flow:**
1. Validates pause duration (1-365 days)
2. Calculates resume date = current period end + pause days
3. Pauses Razorpay subscription at cycle end
4. Updates database with pause details
5. Cron job auto-resumes on resume date

---

### 3. Resume Subscription

**Endpoint:** `POST /influencer/pro/resume`

**Description:** Manually resumes a paused subscription immediately.

**Headers:**
```
Authorization: Bearer <influencer_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription resumed successfully!",
  "subscription": {
    "id": 1,
    "status": "active",
    "currentPeriodStart": "2025-01-20",
    "currentPeriodEnd": "2025-02-19",
    "nextBillingDate": "2025-02-19"
  }
}
```

**Flow:**
1. Resumes Razorpay subscription immediately
2. Sets new billing cycle from resume date
3. Updates influencer Pro status
4. Next autopay charge on new billing date

---

### 4. Cancel Autopay

**Endpoint:** `POST /influencer/pro/cancel-autopay`

**Description:** Cancels UPI autopay but keeps Pro active until period ends.

**Headers:**
```
Authorization: Bearer <influencer_token>
```

**Request Body:**
```json
{
  "reason": "Want to use manual payment" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Autopay cancelled. Your Pro access will remain active until the end of current billing period.",
  "validUntil": "2025-02-15",
  "note": "You can setup autopay again anytime to continue Pro benefits."
}
```

**Flow:**
1. Cancels Razorpay subscription at cycle end
2. Sets `autoRenew = false`
3. Updates `upiMandateStatus = 'cancelled'`
4. Pro remains active until `currentPeriodEnd`
5. Can setup autopay again later

---

## Webhook Configuration

### Razorpay Webhook Setup

1. **Login to Razorpay Dashboard**
   - Go to Settings → Webhooks
   - Click "Add Webhook"

2. **Configure Webhook**
   - URL: `https://yourdomain.com/influencer/webhooks/razorpay`
   - Secret: Generate and save to `.env` as `RAZORPAY_WEBHOOK_SECRET`

3. **Select Events:**

   **Subscription Events:**
   - ✅ `subscription.activated` - Mandate authenticated, first payment successful
   - ✅ `subscription.charged` - Recurring payment successful
   - ✅ `subscription.paused` - Subscription paused
   - ✅ `subscription.resumed` - Subscription resumed
   - ✅ `subscription.cancelled` - Subscription cancelled
   - ✅ `subscription.pending` - Mandate pending authentication
   - ✅ `subscription.halted` - Subscription halted due to failures

   **Payment Events:**
   - ✅ `payment.captured` - Payment successful
   - ✅ `payment.failed` - Payment failed
   - ✅ `payment.authorized` - Payment authorized

4. **Test Webhook**
   - Use Razorpay's webhook tester in dashboard
   - Check your server logs for webhook processing

---

## Webhook Event Handling

### Subscription Events

#### `subscription.activated`
```javascript
// User approved UPI mandate, first payment successful
// Actions:
// - Set status to 'active'
// - Set upiMandateStatus to 'authenticated'
// - Update influencer isPro = true
// - Set proExpiresAt
```

#### `subscription.charged`
```javascript
// Recurring payment successful (auto-charged)
// Actions:
// - Create new invoice
// - Generate PDF
// - Update subscription period (+30 days)
// - Reset autoChargeFailures to 0
// - Extend influencer proExpiresAt
```

#### `subscription.paused`
```javascript
// Subscription paused (via API or auto at cycle end)
// Actions:
// - Set status to 'paused'
// - Set upiMandateStatus to 'paused'
```

#### `subscription.resumed`
```javascript
// Subscription resumed (via API or auto-resume)
// Actions:
// - Set status to 'active'
// - Set upiMandateStatus to 'authenticated'
```

#### `subscription.cancelled`
```javascript
// Subscription cancelled permanently
// Actions:
// - Set status to 'cancelled'
// - Set upiMandateStatus to 'cancelled'
// - Set autoRenew = false
// - Set cancelledAt timestamp
```

### Payment Events

#### `payment.captured`
```javascript
// One-time payment successful
// Actions:
// - Log success
// - Create transaction record
```

#### `payment.failed`
```javascript
// Payment failed (insufficient balance, etc.)
// Actions:
// - Update invoice status to 'failed'
// - Increment autoChargeFailures
// - If failures >= 3, alert admin
// - Set status to 'payment_failed'
```

---

## Cron Jobs

### Auto-Resume Subscriptions

**Schedule:** Every hour
**File:** `src/influencer/services/subscription-scheduler.service.ts`
**Method:** `autoResumeSubscriptions()`

**Logic:**
```typescript
@Cron(CronExpression.EVERY_HOUR)
async autoResumeSubscriptions() {
  // Find all paused subscriptions where resumeDate <= now
  // For each subscription:
  //   - Resume in Razorpay
  //   - Set new billing cycle
  //   - Activate Pro status
  //   - Clear pause fields
}
```

### Expire Subscriptions

**Schedule:** Daily at 1:00 AM
**File:** `src/influencer/services/subscription-scheduler.service.ts`
**Method:** `expireSubscriptions()`

**Logic:**
```typescript
@Cron('0 1 * * *')
async expireSubscriptions() {
  // Find all active subscriptions where currentPeriodEnd < now
  // For each subscription:
  //   - Set status to 'expired'
  //   - Set influencer isPro = false
}
```

---

## User Flow Examples

### Scenario 1: Setup UPI Autopay

1. **User calls:** `POST /influencer/pro/setup-upi-autopay`
2. **Response:** Payment link sent to user's phone
3. **User action:** Opens Google Pay → Approves mandate
4. **Razorpay:** Charges first payment (₹199)
5. **Webhook:** `subscription.activated` → Activates Pro
6. **Result:** User is now Pro with autopay enabled
7. **30 days later:** Razorpay auto-charges ₹199
8. **Webhook:** `subscription.charged` → Creates invoice, extends Pro

### Scenario 2: Pause for 10 Days

**Current date:** Jan 1, 2025
**Current period ends:** Jan 15, 2025

1. **User calls:** `POST /influencer/pro/pause` with `pauseDurationDays: 10`
2. **System calculates:**
   - Pause starts: Jan 15 (after current cycle)
   - Resume date: Jan 25 (15 + 10 days)
3. **Result:** Subscription marked as "will pause on Jan 15"
4. **Jan 15:** Razorpay pauses subscription
5. **Jan 15 - Jan 25:** User has no Pro access (paused)
6. **Jan 25:** Cron job auto-resumes
7. **Razorpay:** Charges ₹199
8. **New billing cycle:** Jan 25 - Feb 24

### Scenario 3: Cancel Autopay

**Current date:** Jan 10, 2025
**Current period ends:** Feb 1, 2025

1. **User calls:** `POST /influencer/pro/cancel-autopay`
2. **Razorpay:** Cancels subscription at cycle end
3. **Jan 10 - Feb 1:** User still has Pro access
4. **Feb 1:** Pro expires, no charge made
5. **Result:** User can manually subscribe or setup autopay again

---

## Testing Guide

### Test Environment Setup

1. **Use Razorpay Test Mode**
   ```bash
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_KEY_SECRET=test_secret_xxx
   ```

2. **Test UPI Apps**
   - Use Razorpay test cards/UPIs
   - Test mandate approval flow

### Test Scenarios

#### ✅ Test 1: Setup UPI Autopay
```bash
curl -X POST http://localhost:3000/influencer/pro/setup-upi-autopay \
  -H "Authorization: Bearer <token>"
```
Expected: Returns autopay link

#### ✅ Test 2: Pause Subscription
```bash
curl -X POST http://localhost:3000/influencer/pro/pause \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"pauseDurationDays": 5, "reason": "Testing"}'
```
Expected: Returns pause details with resume date

#### ✅ Test 3: Resume Subscription
```bash
curl -X POST http://localhost:3000/influencer/pro/resume \
  -H "Authorization: Bearer <token>"
```
Expected: Returns new billing cycle

#### ✅ Test 4: Cancel Autopay
```bash
curl -X POST http://localhost:3000/influencer/pro/cancel-autopay \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing cancellation"}'
```
Expected: Confirms autopay cancelled

#### ✅ Test 5: Webhook
```bash
# Use Razorpay Dashboard → Webhooks → Test Webhook
# Or use curl:
curl -X POST http://localhost:3000/influencer/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: <signature>" \
  -d '{...webhook payload...}'
```
Expected: Webhook processed successfully

---

## Monitoring & Logs

### Key Metrics to Monitor

1. **Subscription Metrics**
   - Active autopay subscriptions count
   - Paused subscriptions count
   - Average pause duration
   - Pause frequency per user

2. **Payment Metrics**
   - Autopay success rate
   - Payment failure rate
   - Failed payment recovery rate
   - Revenue from autopay vs manual

3. **Webhook Health**
   - Webhook delivery success rate
   - Webhook processing errors
   - Event types received

### Log Files

Check these logs for debugging:

```bash
# Subscription activation
grep "Subscription.*activated" logs/app.log

# Auto-resume cron
grep "Auto-resumed.*subscription" logs/app.log

# Payment failures
grep "Payment failed" logs/app.log

# Webhook processing
grep "Razorpay webhook received" logs/app.log
```

---

## Troubleshooting

### Issue: Autopay link not sent to user

**Solution:**
1. Check Razorpay notification settings
2. Verify phone/email in user profile
3. Check Razorpay dashboard for subscription creation

### Issue: Auto-resume not working

**Solution:**
1. Check cron job is running: `ps aux | grep node`
2. Verify resume_date is set correctly in database
3. Check cron job logs for errors
4. Manually trigger: Call `SubscriptionSchedulerService.manualAutoResume()`

### Issue: Webhook signature verification fails

**Solution:**
1. Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
2. Check raw request body is used for signature verification
3. Ensure no body parsing middleware interferes

### Issue: Payment fails repeatedly

**Solution:**
1. Check user has sufficient UPI balance
2. Verify mandate is still active in Razorpay
3. Check `auto_charge_failures` count
4. If failures >= 3, contact user manually

---

## Security Considerations

1. **Webhook Security**
   - ✅ Always verify webhook signatures
   - ✅ Use HTTPS for webhook URL
   - ✅ Rate limit webhook endpoint

2. **API Security**
   - ✅ Authenticate all endpoints with JWT
   - ✅ Validate user owns the subscription
   - ✅ Sanitize user input (pause reason, etc.)

3. **Data Privacy**
   - ✅ Never log sensitive payment info
   - ✅ Encrypt UPI mandate IDs
   - ✅ GDPR-compliant data retention

---

## Production Checklist

- [ ] Run database migration
- [ ] Update environment variables
- [ ] Configure Razorpay webhooks
- [ ] Test UPI autopay flow end-to-end
- [ ] Test pause/resume functionality
- [ ] Verify cron jobs are running
- [ ] Setup monitoring alerts
- [ ] Test webhook signature verification
- [ ] Configure error notifications
- [ ] Document user-facing autopay guide
- [ ] Train support team on troubleshooting

---

## Support & Maintenance

For questions or issues:
1. Check this guide first
2. Review server logs
3. Check Razorpay dashboard for subscription status
4. Contact Razorpay support for payment gateway issues

---

## Version History

- **v1.0** (2025-12-09) - Initial implementation
  - UPI autopay setup
  - Pause/resume functionality
  - Webhook integration
  - Cron jobs for auto-resume

---

**End of Guide** 🎉
