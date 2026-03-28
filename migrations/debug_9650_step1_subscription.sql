-- Step 1: Check subscription details
SELECT
  id,
  "influencerId",
  "razorpaySubscriptionId",
  status,
  "startDate",
  "currentPeriodStart",
  "currentPeriodEnd",
  "subscriptionAmount",
  "paymentMethod",
  "autoRenew",
  "createdAt",
  "updatedAt"
FROM pro_subscriptions
WHERE "razorpaySubscriptionId" = 'sub_SKPZ0O0jmcRcBw';
