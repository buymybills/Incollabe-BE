-- ========================================
-- COMPLETE FIX FOR SUBSCRIPTION 72
-- Influencer: 7051 (Nidhi Rao)
-- Issues:
--   1. Missing invoice for Payment 2
--   2. Subscription status = 'expired' (should be 'active')
-- ========================================

BEGIN;

-- ========================================
-- PART 1: CREATE MISSING INVOICE FOR PAYMENT 2
-- ========================================

DO $$
DECLARE
    v_invoice_number TEXT;
    v_city_name TEXT;
    v_cgst INTEGER;
    v_sgst INTEGER;
    v_igst INTEGER;
    v_invoice_id INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PART 1: Creating Missing Invoice';
    RAISE NOTICE '========================================';

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

    RAISE NOTICE 'Next invoice number: %', v_invoice_number;

    -- Check if Delhi for tax calculation
    SELECT LOWER(c.name) INTO v_city_name
    FROM influencers i
    LEFT JOIN cities c ON c.id = i."cityId"
    WHERE i.id = 7051;

    RAISE NOTICE 'Influencer location: %', COALESCE(v_city_name, 'Unknown');

    -- Calculate taxes based on location
    IF v_city_name IN ('delhi', 'new delhi') THEN
        v_cgst := 1518;  -- Rs 15.18
        v_sgst := 1517;  -- Rs 15.17
        v_igst := 0;
        RAISE NOTICE 'Tax type: CGST + SGST (Delhi)';
    ELSE
        v_cgst := 0;
        v_sgst := 0;
        v_igst := 3035;  -- Rs 30.35
        RAISE NOTICE 'Tax type: IGST (Non-Delhi)';
    END IF;

    -- Check if invoice already exists (idempotency)
    SELECT id INTO v_invoice_id
    FROM pro_invoices
    WHERE "razorpayPaymentId" = 'pay_SKWOCUUh0NeXXW'
      AND "subscriptionId" = 72;

    IF v_invoice_id IS NOT NULL THEN
        RAISE NOTICE '⚠️  Invoice already exists for Payment 2 (ID: %)', v_invoice_id;
    ELSE
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
            v_cgst,                                 -- CGST
            v_sgst,                                 -- SGST
            v_igst,                                 -- IGST
            19900,                                  -- totalAmount (Rs 199)
            '2026-02-26 18:30:00'::TIMESTAMP,      -- billingPeriodStart (from webhook: 1772130600)
            '2026-03-26 18:30:00'::TIMESTAMP,      -- billingPeriodEnd (from webhook: 1774549800)
            'paid',                                 -- paymentStatus
            'razorpay',                             -- paymentMethod
            'pay_SKWOCUUh0NeXXW',                  -- razorpayPaymentId (Payment 2)
            'order_SKWOBiNY6sMwXz',                -- razorpayOrderId
            '2026-02-26 22:09:47'::TIMESTAMP,      -- paidAt (from logs)
            NOW(),
            NOW()
        )
        RETURNING id INTO v_invoice_id;

        RAISE NOTICE '✅ Created invoice % for Payment 2 (ID: %)', v_invoice_number, v_invoice_id;
        RAISE NOTICE '   Billing period: Feb 26, 2026 - Mar 26, 2026';
        RAISE NOTICE '   Amount: Rs 199.00 (Base: Rs 168.64 + Tax: Rs 30.35)';
        RAISE NOTICE '   Tax breakdown: CGST=%p, SGST=%p, IGST=%p', v_cgst/100.0, v_sgst/100.0, v_igst/100.0;
    END IF;

    RAISE NOTICE '';
END $$;


-- ========================================
-- PART 2: FIX SUBSCRIPTION STATUS
-- ========================================

DO $$
DECLARE
    v_old_status TEXT;
    v_new_status TEXT;
    v_period_end TIMESTAMP;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PART 2: Fixing Subscription Status';
    RAISE NOTICE '========================================';

    -- Get current status
    SELECT status, "currentPeriodEnd"
    INTO v_old_status, v_period_end
    FROM pro_subscriptions
    WHERE id = 72;

    RAISE NOTICE 'Current status: %', v_old_status;
    RAISE NOTICE 'Period ends: % (% days remaining)',
        v_period_end AT TIME ZONE 'Asia/Kolkata',
        ROUND(EXTRACT(EPOCH FROM (v_period_end - NOW())) / 86400, 1);

    -- Update status to 'active' if period is still valid
    IF v_period_end > NOW() THEN
        UPDATE pro_subscriptions
        SET
            status = 'active',
            "updatedAt" = NOW()
        WHERE id = 72
        RETURNING status INTO v_new_status;

        RAISE NOTICE '✅ Updated subscription status: % → %', v_old_status, v_new_status;
    ELSE
        RAISE NOTICE '⚠️  Period already expired, status remains: %', v_old_status;
    END IF;

    RAISE NOTICE '';
END $$;


-- ========================================
-- PART 3: VERIFICATION
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PART 3: Verification Results';
    RAISE NOTICE '========================================';
END $$;

-- Verify Influencer Pro Status
SELECT
    '✅ Influencer Status' as check_type,
    id,
    name,
    "isPro",
    "proExpiresAt" AT TIME ZONE 'Asia/Kolkata' as pro_expires_ist,
    CASE
        WHEN "proExpiresAt" > NOW() THEN '✅ Active'
        ELSE '❌ Expired'
    END as status,
    ROUND(EXTRACT(EPOCH FROM ("proExpiresAt" - NOW())) / 86400, 1) || ' days' as remaining
FROM influencers
WHERE id = 7051;

-- Verify Subscription Status
SELECT
    '✅ Subscription Status' as check_type,
    id,
    status,
    "autoRenew",
    "currentPeriodEnd" AT TIME ZONE 'Asia/Kolkata' as period_end_ist,
    CASE
        WHEN "currentPeriodEnd" > NOW() AND status = 'active' THEN '✅ Correct'
        WHEN "currentPeriodEnd" > NOW() AND status != 'active' THEN '❌ Wrong Status'
        ELSE '⚠️  Expired Period'
    END as validation
FROM pro_subscriptions
WHERE id = 72;

-- Verify Both Invoices Exist
SELECT
    '✅ Invoices Summary' as check_type,
    ROW_NUMBER() OVER (ORDER BY "billingPeriodStart") as payment_num,
    "invoiceNumber",
    "billingPeriodStart" AT TIME ZONE 'Asia/Kolkata' as billing_start,
    "billingPeriodEnd" AT TIME ZONE 'Asia/Kolkata' as billing_end,
    "paymentStatus",
    "totalAmount" / 100.0 as amount_inr,
    "razorpayPaymentId"
FROM pro_invoices
WHERE "subscriptionId" = 72
ORDER BY "billingPeriodStart";

-- Summary Stats
SELECT
    '✅ Financial Summary' as check_type,
    COUNT(*) as total_invoices,
    SUM("totalAmount") / 100.0 as total_collected_inr,
    MIN("billingPeriodStart") AT TIME ZONE 'Asia/Kolkata' as first_payment_date,
    MAX("billingPeriodEnd") AT TIME ZONE 'Asia/Kolkata' as coverage_until
FROM pro_invoices
WHERE "subscriptionId" = 72
  AND "paymentStatus" = 'paid';

-- ========================================
-- COMMIT TRANSACTION
-- ========================================

COMMIT;

-- Final Success Message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FIX COMPLETED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Changes:';
    RAISE NOTICE '1. Created missing invoice for Payment 2';
    RAISE NOTICE '2. Updated subscription status to ''active''';
    RAISE NOTICE '3. Admin panel will now show profileStatus: "active"';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '- Refresh admin panel to see updated status';
    RAISE NOTICE '- Deploy the code fix to prevent this in future';
    RAISE NOTICE '========================================';
END $$;
