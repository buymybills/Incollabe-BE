-- ============================================================
-- Check pro_subscription_transactions for payment capture
-- Subscription ID: 183
-- ============================================================

-- Check all transactions for this subscription
SELECT
  id,
  "subscriptionId",
  "transactionType",
  "razorpayPaymentId",
  "razorpayOrderId",
  amount,
  status,
  "webhookPayload",
  "createdAt"
FROM pro_subscription_transactions
WHERE "subscriptionId" = 183
ORDER BY "createdAt" DESC;

-- Also check by influencer ID
\echo ''
\echo 'Transactions by Influencer ID:'
SELECT
  id,
  "subscriptionId",
  "transactionType",
  "razorpayPaymentId",
  amount,
  status,
  "createdAt"
FROM pro_subscription_transactions
WHERE "subscriptionId" IN (
  SELECT id FROM pro_subscriptions WHERE "influencerId" = 9650
)
ORDER BY "createdAt" DESC;
