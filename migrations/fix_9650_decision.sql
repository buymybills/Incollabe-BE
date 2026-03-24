-- ============================================================
-- Decision: What to do with subscription 183 (no invoice)
-- Check if there are other subscriptions first
-- ============================================================

-- Check all subscriptions for this influencer
SELECT
  id,
  "razorpaySubscriptionId",
  status,
  "startDate",
  "currentPeriodEnd",
  "autoRenew",
  "createdAt",
  (SELECT COUNT(*) FROM pro_invoices WHERE "subscriptionId" = pro_subscriptions.id) as invoice_count
FROM pro_subscriptions
WHERE "influencerId" = 9650
ORDER BY "createdAt" DESC;

-- Check influencer's current Pro status
\echo ''
\echo 'Influencer Pro Status:'
SELECT
  id,
  name,
  username,
  "isPro",
  "proActivatedAt",
  "proExpiresAt"
FROM influencer
WHERE id = 9650;

\echo ''
\echo '=== DECISION MATRIX ==='
\echo '1. If there are OTHER active/working subscriptions → CANCEL this broken one (183)'
\echo '2. If this is the ONLY subscription and user wants Pro → CREATE the invoice'
\echo '3. If user does not need Pro anymore → CANCEL this subscription'
