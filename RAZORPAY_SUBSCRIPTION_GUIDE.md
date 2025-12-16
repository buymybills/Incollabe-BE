# Razorpay Subscription Auto-Payment Guide

## ✅ What's Already Working

Your backend already has:
1. ✅ Subscription creation (`createSubscriptionOrder`)
2. ✅ Payment verification (`verifyAndActivateSubscription`)
3. ✅ Webhook endpoint (`POST /influencer/webhooks/razorpay`)
4. ✅ Basic webhook handling (`handleWebhook`)
5. ✅ Cancellation method (`cancelSubscription`)

## 🔧 What Needs to Be Enhanced

### 1. Update Webhook Handler for Subscription Events

**Current Issue:** Your webhook handler only processes payment events, not subscription events.

**Location:** `src/influencer/services/pro-subscription.service.ts` - Line 628

**Add these subscription events to the `handleWebhook` method:**

```typescript
async handleWebhook(event: string, payload: any) {
  try {
    console.log(`Razorpay webhook received: ${event}`, payload);

    // Handle SUBSCRIPTION events
    if (event.startsWith('subscription.')) {
      return await this.handleSubscriptionWebhook(event, payload);
    }

    // Handle PAYMENT events (existing code)
    const invoice = await this.proInvoiceModel.findOne({
      where: {
        [Op.or]: [
          { razorpayPaymentId: payload.payment?.entity?.id },
          { razorpayOrderId: payload.payment?.entity?.order_id },
        ],
      },
    });

    // ... rest of existing code
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { success: false, error: error.message };
  }
}
```

### 2. Add New Method: Handle Subscription Webhooks

**Add this new method to `ProSubscriptionService`:**

```typescript
/**
 * Handle subscription-specific webhook events
 */
async handleSubscriptionWebhook(event: string, payload: any) {
  try {
    const subscriptionData = payload.subscription?.entity;
    if (!subscriptionData) {
      return { success: false, message: 'No subscription data in payload' };
    }

    const razorpaySubscriptionId = subscriptionData.id;

    // Find subscription in database
    const subscription = await this.proSubscriptionModel.findOne({
      where: { razorpaySubscriptionId },
    });

    if (!subscription) {
      console.log(`Subscription not found: ${razorpaySubscriptionId}`);
      return { success: false, message: 'Subscription not found' };
    }

    const now = createDatabaseDate();

    switch (event) {
      case 'subscription.charged':
        // Recurring payment succeeded
        await this.handleSubscriptionCharged(subscription, subscriptionData, payload);
        break;

      case 'subscription.cancelled':
        // Subscription was cancelled
        await subscription.update({
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
        });
        await this.influencerModel.update(
          { isPro: false },
          { where: { id: subscription.influencerId } }
        );
        console.log(`Subscription ${subscription.id} cancelled`);
        break;

      case 'subscription.completed':
        // All payments completed (12 months done)
        await subscription.update({
          status: SubscriptionStatus.COMPLETED,
        });
        await this.influencerModel.update(
          { isPro: false },
          { where: { id: subscription.influencerId } }
        );
        console.log(`Subscription ${subscription.id} completed`);
        break;

      case 'subscription.halted':
        // Multiple payment failures - subscription halted
        await subscription.update({
          status: SubscriptionStatus.PAYMENT_FAILED,
        });
        await this.influencerModel.update(
          { isPro: false },
          { where: { id: subscription.influencerId } }
        );
        console.log(`Subscription ${subscription.id} halted due to payment failures`);
        break;

      case 'subscription.paused':
        // Subscription paused
        await subscription.update({
          status: SubscriptionStatus.PAUSED,
        });
        console.log(`Subscription ${subscription.id} paused`);
        break;

      case 'subscription.resumed':
        // Subscription resumed
        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
        });
        console.log(`Subscription ${subscription.id} resumed`);
        break;

      default:
        console.log(`Unhandled subscription event: ${event}`);
    }

    return { success: true, message: 'Subscription webhook processed' };
  } catch (error) {
    console.error('Error processing subscription webhook:', error);
    return { success: false, error: error.message };
  }
}
```

### 3. Add Method: Handle Recurring Charges

**Add this method to create invoices for recurring payments:**

```typescript
/**
 * Handle subscription.charged event (recurring payment)
 */
async handleSubscriptionCharged(
  subscription: ProSubscription,
  subscriptionData: any,
  payload: any
) {
  try {
    const payment = payload.payment?.entity;
    if (!payment) {
      console.error('No payment data in subscription.charged event');
      return;
    }

    // Generate new invoice for this recurring payment
    const invoiceNumber = await this.generateInvoiceNumber();

    const startDate = new Date(subscriptionData.current_start * 1000);
    const endDate = new Date(subscriptionData.current_end * 1000);

    // Create invoice for recurring payment
    const invoice = await this.proInvoiceModel.create({
      invoiceNumber,
      subscriptionId: subscription.id,
      influencerId: subscription.influencerId,
      amount: payment.amount,
      tax: 0,
      totalAmount: payment.amount,
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      paymentStatus: InvoiceStatus.PAID,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      paidAt: createDatabaseDate(),
    });

    // Update subscription period
    await subscription.update({
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      nextBillingDate: endDate,
    });

    // Update influencer Pro expiry
    await this.influencerModel.update(
      {
        isPro: true,
        proExpiresAt: endDate,
      },
      { where: { id: subscription.influencerId } }
    );

    // Create payment transaction record
    await this.proPaymentTransactionModel.create({
      invoiceId: invoice.id,
      influencerId: subscription.influencerId,
      transactionType: TransactionType.PAYMENT,
      amount: payment.amount,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      status: TransactionStatus.SUCCESS,
      paymentMethod: PaymentMethod.RAZORPAY,
      metadata: {
        subscriptionId: subscription.id,
        invoiceNumber: invoice.invoiceNumber,
        recurringPayment: true,
      },
    });

    // Generate invoice PDF
    await this.generateInvoicePDF(invoice.id);

    console.log(`Recurring payment processed for subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription charge:', error);
    throw error;
  }
}
```

### 4. Update Subscription Model

**Add new status to your subscription model if not already present:**

```typescript
export enum SubscriptionStatus {
  PAYMENT_PENDING = 'payment_pending',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAYMENT_FAILED = 'payment_failed',
  PAUSED = 'paused',           // ADD THIS
  COMPLETED = 'completed',     // ADD THIS
}
```

### 5. Update Subscription Creation to Store Razorpay Subscription ID

**In `createSubscriptionOrder` method, you're currently creating a Razorpay ORDER, not a SUBSCRIPTION.**

**Change this section (around line 109-119):**

```typescript
// OLD CODE - Creates a one-time order
const razorpayOrder = await this.razorpayService.createOrder(
  199,
  'INR',
  `PRO_SUB_${subscription.id}_INV_${invoice.id}`,
  { ... }
);
```

**TO:**

```typescript
// NEW CODE - Creates a recurring subscription
const razorpaySubscription = await this.razorpayService.createSubscription(
  process.env.RAZORPAY_PRO_PLAN_ID,
  12, // total_count - 12 monthly payments
  null, // customerId (optional)
  {
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    influencerId,
    influencerName: influencer.name,
  }
);

if (!razorpaySubscription.success) {
  throw new BadRequestException('Failed to create subscription');
}

// Update subscription with Razorpay subscription ID
await subscription.update({
  razorpaySubscriptionId: razorpaySubscription.subscriptionId,
});

// Update invoice with first order ID
await invoice.update({
  razorpayOrderId: razorpaySubscription.data.notes?.first_order_id,
});

return {
  subscription: {
    id: subscription.id,
    status: subscription.status,
    razorpaySubscriptionId: razorpaySubscription.subscriptionId,
  },
  payment: {
    subscriptionId: razorpaySubscription.subscriptionId,
    shortUrl: razorpaySubscription.shortUrl,
    keyId: process.env.RAZORPAY_KEY_ID,
  },
};
```

### 6. Setup Razorpay Webhooks

**Steps:**

1. **Go to Razorpay Dashboard:**
   - https://dashboard.razorpay.com/app/webhooks

2. **Create Webhook:**
   - **Webhook URL:** `https://your-domain.com/api/influencer/webhooks/razorpay`
   - **Secret:** Use the value from `.env` → `RAZORPAY_WEBHOOK_SECRET`

3. **Enable These Events:**
   - ✅ `subscription.charged` - Recurring payment successful
   - ✅ `subscription.cancelled` - Subscription cancelled
   - ✅ `subscription.completed` - All payments done
   - ✅ `subscription.halted` - Multiple failures
   - ✅ `subscription.paused` - Subscription paused
   - ✅ `subscription.resumed` - Subscription resumed
   - ✅ `payment.failed` - Payment failed
   - ✅ `payment.captured` - Payment successful

4. **Test Webhook:**
   - Razorpay provides a "Send Test Webhook" button
   - Test each event to ensure your handler works

## 🧪 Testing Auto-Payment

### Test Recurring Payment (Monthly Charge)

Since you can't wait 30 days, Razorpay provides a way to test:

1. **Trigger Manual Charge (Test Mode):**
```bash
curl -X POST https://api.razorpay.com/v1/invoices \
  -u rzp_test_spyovD2YYBpW4s:2DJmS8Xk2QBeGLDXgqXXrioE \
  -H "Content-Type: application/json" \
  -d '{
    "type": "link",
    "description": "Test recurring charge for subscription sub_XXXXX",
    "subscription_id": "sub_Rp6GGjid6kMyRQ",
    "customer": {
      "name": "Test User",
      "email": "test@example.com",
      "contact": "+919999999999"
    },
    "amount": 19900,
    "currency": "INR"
  }'
```

2. **Or use Razorpay Dashboard:**
   - Go to Subscriptions → Select subscription
   - Click "Charge Now" to test recurring payment

## 🧪 Testing Cancellation

### Option 1: Via Your API
```bash
curl -X POST http://localhost:3002/api/influencer/pro/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing cancellation"}'
```

### Option 2: Via Razorpay API
```bash
curl -X POST https://api.razorpay.com/v1/subscriptions/sub_Rp6GGjid6kMyRQ/cancel \
  -u rzp_test_spyovD2YYBpW4s:2DJmS8Xk2QBeGLDXgqXXrioE
```

### Option 3: Via Razorpay Dashboard
1. Go to Subscriptions
2. Select the subscription
3. Click "Cancel"

## 📊 How Auto-Payment Works

1. **Day 1:** User subscribes and pays Rs 199 (first payment)
2. **Day 31:** Razorpay automatically charges Rs 199
   - Sends `subscription.charged` webhook
   - Your backend creates new invoice
   - Updates user's Pro expiry date
3. **Day 61:** Razorpay charges again
4. **Continues for 12 months**

## 🚨 Handling Payment Failures

If a recurring payment fails:

1. **First Failure:** Razorpay retries automatically (up to 4 times over 2 weeks)
2. **Webhooks sent:**
   - `payment.failed` - Each failed attempt
   - `subscription.halted` - After all retries exhausted
3. **Your Backend Should:**
   - Notify user via email/push notification
   - Update subscription status to `payment_failed`
   - Disable Pro features

## 📝 Checklist

- [ ] Update webhook handler to support subscription events
- [ ] Add `handleSubscriptionWebhook` method
- [ ] Add `handleSubscriptionCharged` method
- [ ] Update subscription model with new statuses
- [ ] Change `createSubscriptionOrder` to use Razorpay subscriptions API
- [ ] Setup webhooks in Razorpay Dashboard
- [ ] Test cancellation flow
- [ ] Test webhook events
- [ ] Add user notifications for payment failures
- [ ] Add user notifications for successful recurring payments

## 🔗 Razorpay Resources

- **Subscriptions API:** https://razorpay.com/docs/api/subscriptions/
- **Webhooks:** https://razorpay.com/docs/webhooks/
- **Test Cards:** https://razorpay.com/docs/payments/payments/test-card-upi-details/
