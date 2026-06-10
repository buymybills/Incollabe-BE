-- ============================================================
-- Debug: Influencer 9650 - Subscription stuck in payment_pending
-- Subscription: sub_SKPZ0O0jmcRcBw
-- ============================================================

-- Query 1: Check subscription details
\echo '=== QUERY 1: Subscription Details ==='
SELECT
  id,
  "influencerId",
  "razorpaySubscriptionId",
  status,
  "startDate",
  "currentPeriodStart",
  "currentPeriodEnd",
  "nextBillingDate",
  "subscriptionAmount",
  "paymentMethod",
  "autoRenew",
  "razorpayCustomerId",
  "createdAt",
  "updatedAt"
FROM pro_subscriptions
WHERE "razorpaySubscriptionId" = 'sub_SKPZ0O0jmcRcBw';

\echo ''
\echo 'Press Enter to continue to Query 2...'
\prompt

-- Query 2: Check if invoices exist for this subscription
\echo '=== QUERY 2: Invoice Details ==='
SELECT
  pi.id as invoice_id,
  pi."invoiceNumber",
  pi."subscriptionId",
  pi."influencerId",
  pi."paymentStatus",
  pi."razorpayPaymentId",
  pi."razorpayOrderId",
  pi.amount,
  pi.tax,
  pi."totalAmount",
  pi."paymentMethod",
  pi."paidAt",
  pi."createdAt",
  pi."updatedAt"
FROM pro_invoices pi
WHERE pi."subscriptionId" = (
  SELECT id FROM pro_subscriptions
  WHERE "razorpaySubscriptionId" = 'sub_SKPZ0O0jmcRcBw'
)
ORDER BY pi."createdAt" DESC;

\echo ''
\echo 'Press Enter to continue to Query 3...'
\prompt

-- Query 3: Check influencer's current Pro status
\echo '=== QUERY 3: Influencer Pro Status ==='
SELECT
  id,
  name,
  username,
  "isPro",
  "proActivatedAt",
  "proExpiresAt",
  "createdAt",
  "updatedAt"
FROM influencer
WHERE id = 9650;

\echo ''
\echo 'Press Enter to continue to Query 4...'
\prompt

-- Query 4: Check if there are OTHER subscriptions for this influencer
\echo '=== QUERY 4: All Subscriptions for Influencer 9650 ==='
SELECT
  id,
  "razorpaySubscriptionId",
  status,
  "startDate",
  "currentPeriodEnd",
  "subscriptionAmount",
  "autoRenew",
  "createdAt"
FROM pro_subscriptions
WHERE "influencerId" = 9650
ORDER BY "createdAt" DESC;

\echo ''
\echo 'Press Enter to continue to Query 5...'
\prompt

-- Query 5: Count invoices by status for this subscription
\echo '=== QUERY 5: Invoice Count by Status ==='
SELECT
  "paymentStatus",
  COUNT(*) as count,
  SUM("totalAmount") as total_amount
FROM pro_invoices
WHERE "subscriptionId" = (
  SELECT id FROM pro_subscriptions
  WHERE "razorpaySubscriptionId" = 'sub_SKPZ0O0jmcRcBw'
)
GROUP BY "paymentStatus";

\echo ''
\echo '=== DEBUG COMPLETE ==='
