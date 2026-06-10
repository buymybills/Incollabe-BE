-- Step 2: Check invoices for this subscription
SELECT
  pi.id as invoice_id,
  pi."invoiceNumber",
  pi."subscriptionId",
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
