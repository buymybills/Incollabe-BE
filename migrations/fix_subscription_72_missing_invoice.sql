-- ========================================
-- DIAGNOSTIC AND FIX QUERIES FOR SUBSCRIPTION 72
-- Influencer: 7051 (Nidhi Rao)
-- Issue: Payment 2 missing invoice
-- ========================================

-- ========================================
-- PART 1: DIAGNOSTIC QUERIES
-- ========================================

-- Query 1: Check Influencer's Pro Status
-- ========================================
SELECT
    id,
    name,
    "isPro",
    "proActivatedAt" AT TIME ZONE 'Asia/Kolkata' as pro_activated_ist,
    "proExpiresAt" AT TIME ZONE 'Asia/Kolkata' as pro_expires_ist,
    CASE
        WHEN "proExpiresAt" > NOW() THEN '✅ Active'
        WHEN "proExpiresAt" <= NOW() THEN '❌ Expired'
        ELSE '⚠️ Never Activated'
    END as pro_status,
    CASE
        WHEN "proExpiresAt" > NOW() THEN
            ROUND(EXTRACT(EPOCH FROM ("proExpiresAt" - NOW())) / 86400, 1) || ' days remaining'
        ELSE 'Expired or N/A'
    END as days_remaining
FROM influencers
WHERE id = 7051;

-- Expected: isPro = true, proExpiresAt should be around Mar 26, 2026


-- Query 2: Check Subscription 72 Details
-- ========================================
SELECT
    id,
    "influencerId",
    "razorpaySubscriptionId",
    status,
    "startDate" AT TIME ZONE 'Asia/Kolkata' as start_date_ist,
    "currentPeriodStart" AT TIME ZONE 'Asia/Kolkata' as current_period_start_ist,
    "currentPeriodEnd" AT TIME ZONE 'Asia/Kolkata' as current_period_end_ist,
    "nextBillingDate" AT TIME ZONE 'Asia/Kolkata' as next_billing_date_ist,
    "subscriptionAmount" / 100.0 as amount_inr,
    "autoRenew",
    "createdAt" AT TIME ZONE 'Asia/Kolkata' as created_at_ist
FROM pro_subscriptions
WHERE id = 72;

-- Expected: razorpaySubscriptionId = 'sub_S8mpWDPh2N6uPv'


-- Query 3: List All Invoices for Subscription 72
-- ========================================
SELECT
    id,
    "invoiceNumber",
    "billingPeriodStart" AT TIME ZONE 'Asia/Kolkata' as billing_start_ist,
    "billingPeriodEnd" AT TIME ZONE 'Asia/Kolkata' as billing_end_ist,
    EXTRACT(DAY FROM ("billingPeriodEnd" - "billingPeriodStart")) as billing_days,
    "paymentStatus",
    "totalAmount" / 100.0 as amount_inr,
    "razorpayPaymentId",
    "razorpayOrderId",
    "paidAt" AT TIME ZONE 'Asia/Kolkata' as paid_at_ist,
    "createdAt" AT TIME ZONE 'Asia/Kolkata' as created_at_ist
FROM pro_invoices
WHERE "subscriptionId" = 72
ORDER BY "billingPeriodStart" ASC;

-- Expected: Only 1 invoice (MAXXINV-202601-48) for Payment 1


-- Query 4: List All Payment Transactions for Subscription 72
-- ========================================
SELECT
    id,
    "invoiceId",
    "transactionType",
    "razorpayPaymentId",
    "razorpayOrderId",
    "amount" / 100.0 as amount_inr,
    status,
    "paymentMethod",
    "webhookEvent",
    "processedAt" AT TIME ZONE 'Asia/Kolkata' as processed_at_ist,
    "createdAt" AT TIME ZONE 'Asia/Kolkata' as created_at_ist
FROM pro_payment_transactions
WHERE "subscriptionId" = 72
ORDER BY "createdAt" ASC;

-- Expected: Should see transactions for both payments


-- Query 5: Payment-to-Invoice Mapping Summary
-- ========================================
WITH payments AS (
    SELECT
        ROW_NUMBER() OVER (ORDER BY "createdAt") as payment_number,
        id as transaction_id,
        "invoiceId",
        "razorpayPaymentId",
        "razorpayOrderId",
        "amount" / 100.0 as amount_inr,
        status,
        "transactionType",
        "processedAt" AT TIME ZONE 'Asia/Kolkata' as processed_at_ist
    FROM pro_payment_transactions
    WHERE "subscriptionId" = 72
      AND "transactionType" IN ('payment.captured', 'subscription.charged')
      AND status = 'captured'
    ORDER BY "createdAt"
)
SELECT
    p.payment_number,
    p.transaction_id,
    p."razorpayPaymentId",
    p.amount_inr,
    p.processed_at_ist,
    p."invoiceId" as linked_invoice_id,
    COALESCE(i."invoiceNumber", '❌ MISSING') as invoice_number,
    COALESCE(i."paymentStatus", 'N/A') as invoice_status,
    CASE
        WHEN i.id IS NULL THEN '❌ NO INVOICE'
        WHEN p."invoiceId" IS NULL THEN '⚠️ INVOICE EXISTS BUT NOT LINKED'
        ELSE '✅ HAS INVOICE'
    END as status
FROM payments p
LEFT JOIN pro_invoices i ON i."razorpayPaymentId" = p."razorpayPaymentId"
ORDER BY p.payment_number;

-- Expected Output:
-- Payment 1: ✅ HAS INVOICE (MAXXINV-202601-48)
-- Payment 2: ❌ NO INVOICE (razorpayPaymentId = pay_SKWOCUUh0NeXXW)


-- Query 6: Verify Payment 2 Specifically
-- ========================================
SELECT
    'Payment 2 Details' as info,
    pt.id as transaction_id,
    pt."razorpayPaymentId",
    pt."razorpayOrderId",
    pt."invoiceId",
    pt."amount" / 100.0 as amount_inr,
    pt.status,
    pt."processedAt" AT TIME ZONE 'Asia/Kolkata' as processed_at_ist,
    i.id as invoice_id,
    i."invoiceNumber"
FROM pro_payment_transactions pt
LEFT JOIN pro_invoices i ON i."razorpayPaymentId" = pt."razorpayPaymentId"
WHERE pt."razorpayPaymentId" = 'pay_SKWOCUUh0NeXXW'
  AND pt."subscriptionId" = 72;

-- Expected: Transaction exists, but invoice is NULL


-- ========================================
-- PART 2: FIX - CREATE MISSING INVOICE FOR PAYMENT 2
-- ========================================

-- Step 1: Get next invoice number for influencer 7051
-- ========================================
SELECT
    'Next invoice number will be:' as info,
    'MAXXINV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
    LPAD((
        COALESCE(
            MAX(CAST(SUBSTRING("invoiceNumber" FROM '\d+$') AS INTEGER)),
            0
        ) + 1
    )::TEXT, 2, '0') as next_invoice_number
FROM pro_invoices
WHERE "influencerId" = 7051
  AND "invoiceNumber" LIKE 'MAXXINV-%';


-- Step 2: Check influencer's city for tax calculation
-- ========================================
SELECT
    i.id as influencer_id,
    i.name,
    i."cityId",
    c.name as city_name,
    CASE
        WHEN LOWER(c.name) IN ('delhi', 'new delhi') THEN 'Delhi (CGST + SGST)'
        ELSE 'Other (IGST)'
    END as tax_type
FROM influencers i
LEFT JOIN cities c ON c.id = i."cityId"
WHERE i.id = 7051;


-- Step 3: INSERT Missing Invoice for Payment 2
-- ========================================
-- IMPORTANT: Review the values below before executing!
-- Adjust CGST/SGST/IGST based on city from Step 2

DO $$
DECLARE
    v_invoice_number TEXT;
    v_is_delhi BOOLEAN;
    v_cgst INTEGER;
    v_sgst INTEGER;
    v_igst INTEGER;
    v_city_name TEXT;
BEGIN
    -- Get next invoice number
    SELECT 'MAXXINV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
           LPAD((
               COALESCE(
                   MAX(CAST(SUBSTRING("invoiceNumber" FROM '\d+$') AS INTEGER)),
                   0
               ) + 1
           )::TEXT, 2, '0')
    INTO v_invoice_number
    FROM pro_invoices
    WHERE "influencerId" = 7051
      AND "invoiceNumber" LIKE 'MAXXINV-%';

    -- Check if Delhi for tax calculation
    SELECT LOWER(c.name) INTO v_city_name
    FROM influencers i
    LEFT JOIN cities c ON c.id = i."cityId"
    WHERE i.id = 7051;

    v_is_delhi := (v_city_name IN ('delhi', 'new delhi'));

    -- Calculate taxes
    IF v_is_delhi THEN
        v_cgst := 1518;  -- Rs 15.18
        v_sgst := 1517;  -- Rs 15.17
        v_igst := 0;
    ELSE
        v_cgst := 0;
        v_sgst := 0;
        v_igst := 3035;  -- Rs 30.35
    END IF;

    -- Create invoice for Payment 2
    INSERT INTO pro_invoices (
        "invoiceNumber",
        "subscriptionId",
        "influencerId",
        amount,
        tax,
        cgst,
        sgst,
        igst,
        "totalAmount",
        "billingPeriodStart",
        "billingPeriodEnd",
        "paymentStatus",
        "paymentMethod",
        "razorpayPaymentId",
        "razorpayOrderId",
        "paidAt",
        "createdAt",
        "updatedAt"
    ) VALUES (
        v_invoice_number,
        72,                                     -- subscriptionId
        7051,                                   -- influencerId
        16864,                                  -- amount (Rs 168.64 in paise)
        3035,                                   -- tax (Rs 30.35 in paise)
        v_cgst,                                 -- CGST (based on city)
        v_sgst,                                 -- SGST (based on city)
        v_igst,                                 -- IGST (based on city)
        19900,                                  -- totalAmount (Rs 199 in paise)
        '2026-02-26 18:30:00'::TIMESTAMP,      -- billingPeriodStart (from webhook current_start: 1772130600)
        '2026-03-26 18:30:00'::TIMESTAMP,      -- billingPeriodEnd (from webhook current_end: 1774549800)
        'paid',                                 -- paymentStatus
        'razorpay',                             -- paymentMethod
        'pay_SKWOCUUh0NeXXW',                  -- razorpayPaymentId (Payment 2 ID from webhook)
        'order_SKWOBiNY6sMwXz',                -- razorpayOrderId (from webhook)
        '2026-02-26 22:09:47'::TIMESTAMP,      -- paidAt (from webhook logs)
        NOW(),                                  -- createdAt
        NOW()                                   -- updatedAt
    );

    RAISE NOTICE '✅ Created invoice % for Payment 2', v_invoice_number;
    RAISE NOTICE 'Tax breakdown: CGST=%, SGST=%, IGST=%', v_cgst, v_sgst, v_igst;
END $$;


-- Step 4: Update payment transaction to link the new invoice
-- ========================================
UPDATE pro_payment_transactions
SET "invoiceId" = (
    SELECT id
    FROM pro_invoices
    WHERE "razorpayPaymentId" = 'pay_SKWOCUUh0NeXXW'
    LIMIT 1
)
WHERE "razorpayPaymentId" = 'pay_SKWOCUUh0NeXXW'
  AND "subscriptionId" = 72
  AND "invoiceId" IS NULL;


-- ========================================
-- PART 3: VERIFICATION AFTER FIX
-- ========================================

-- Verify 1: Check both invoices now exist
-- ========================================
SELECT
    ROW_NUMBER() OVER (ORDER BY "billingPeriodStart") as payment_number,
    id,
    "invoiceNumber",
    "billingPeriodStart" AT TIME ZONE 'Asia/Kolkata' as billing_start_ist,
    "billingPeriodEnd" AT TIME ZONE 'Asia/Kolkata' as billing_end_ist,
    "paymentStatus",
    "totalAmount" / 100.0 as amount_inr,
    "razorpayPaymentId",
    "paidAt" AT TIME ZONE 'Asia/Kolkata' as paid_at_ist
FROM pro_invoices
WHERE "subscriptionId" = 72
ORDER BY "billingPeriodStart" ASC;

-- Expected: 2 invoices
-- Payment 1: MAXXINV-202601-48 (Jan billing period)
-- Payment 2: MAXXINV-202602-XX (Feb 26 - Mar 26 billing period)


-- Verify 2: Check all transactions are linked to invoices
-- ========================================
SELECT
    pt.id as transaction_id,
    pt."razorpayPaymentId",
    pt."invoiceId",
    i."invoiceNumber",
    CASE
        WHEN pt."invoiceId" IS NOT NULL THEN '✅ Linked'
        ELSE '❌ Not Linked'
    END as link_status
FROM pro_payment_transactions pt
LEFT JOIN pro_invoices i ON i.id = pt."invoiceId"
WHERE pt."subscriptionId" = 72
  AND pt."transactionType" IN ('payment.captured', 'subscription.charged')
  AND pt.status = 'captured'
ORDER BY pt."createdAt";

-- Expected: Both transactions linked to invoices


-- Verify 3: Final Summary
-- ========================================
SELECT
    '✅ FIXED' as status,
    COUNT(*) as total_invoices,
    SUM("totalAmount") / 100.0 as total_collected_inr,
    MIN("billingPeriodStart") AT TIME ZONE 'Asia/Kolkata' as first_payment_date,
    MAX("billingPeriodEnd") AT TIME ZONE 'Asia/Kolkata' as coverage_until
FROM pro_invoices
WHERE "subscriptionId" = 72
  AND "paymentStatus" = 'paid';

-- Expected:
-- total_invoices: 2
-- total_collected_inr: 398.00 (Rs 199 × 2)
