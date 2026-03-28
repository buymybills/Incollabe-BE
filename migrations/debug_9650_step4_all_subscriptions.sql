-- Step 4: Check all subscriptions for this influencer
SELECT
  id,
  "razorpaySubscriptionId",
  status,
  "startDate",
  "currentPeriodStart",
  "currentPeriodEnd",
  "subscriptionAmount",
  "autoRenew",
  "createdAt"
FROM pro_subscriptions
WHERE "influencerId" = 9650
ORDER BY "createdAt" DESC;
