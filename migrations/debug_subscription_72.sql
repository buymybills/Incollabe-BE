-- Debug: Check subscription 72 and its invoices

-- 1. Check subscription details
SELECT
  id,
  "influencerId",
  status,
  "currentPeriodStart",
  "currentPeriodEnd",
  "nextBillingDate",
  "createdAt",
  "updatedAt"
FROM pro_subscriptions
WHERE id = 72;

-- 2. Check all invoices for subscription 72
SELECT
  id,
  "subscriptionId",
  "invoiceNumber",
  "billingPeriodStart",
  "billingPeriodEnd",
  amount,
  tax,
  "totalAmount",
  "paymentStatus",
  "paidAt",
  "createdAt"
FROM pro_invoices
WHERE "subscriptionId" = 72
ORDER BY "billingPeriodStart";

-- 3. Check payment transactions
SELECT
  id,
  "subscriptionId",
  "transactionType",
  "transactionStatus",
  amount,
  "razorpayPaymentId",
  "createdAt"
FROM pro_payment_transactions
WHERE "subscriptionId" = 72
ORDER BY "createdAt";
