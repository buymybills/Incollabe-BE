-- ============================================================
-- Option A: Cancel the broken subscription (no invoice)
-- Use this if there are other working subscriptions
-- or if user no longer needs this subscription
-- ============================================================

UPDATE pro_subscriptions
SET
  status = 'cancelled',
  "updatedAt" = NOW()
WHERE id = 183
  AND status = 'payment_pending'
  AND NOT EXISTS (
    SELECT 1 FROM pro_invoices
    WHERE "subscriptionId" = 183
  );

-- Verify cancellation
SELECT
  id,
  "razorpaySubscriptionId",
  status,
  "updatedAt"
FROM pro_subscriptions
WHERE id = 183;

\echo '✅ Subscription 183 has been cancelled (no invoice existed, so nothing to refund)'
