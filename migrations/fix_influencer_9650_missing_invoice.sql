-- ============================================================
-- Fix: Create missing invoice for subscription sub_SKPZ0O0jmcRcBw
-- Influencer: 9650, Subscription ID: 183
-- ============================================================

-- First, let's check the influencer's state
SELECT
  id,
  name,
  username,
  state,
  city
FROM influencer
WHERE id = 9650;

-- Calculate tax based on location
-- If Delhi: CGST (9%) + SGST (9%) = 18%
-- If other state: IGST (18%)

DO $$
DECLARE
  v_subscription_id INTEGER := 183;
  v_influencer_id INTEGER := 9650;
  v_base_amount NUMERIC := 16864.41;
  v_cgst NUMERIC := 0;
  v_sgst NUMERIC := 0;
  v_igst NUMERIC := 0;
  v_total_tax NUMERIC := 3035.59;
  v_total_amount NUMERIC := 19900;
  v_invoice_number VARCHAR;
  v_influencer_state VARCHAR;
  v_invoice_id INTEGER;
BEGIN
  -- Get influencer's state
  SELECT state INTO v_influencer_state
  FROM influencer
  WHERE id = v_influencer_id;

  -- Calculate taxes based on state
  IF v_influencer_state = 'Delhi' THEN
    v_cgst := ROUND(v_base_amount * 0.09, 2);
    v_sgst := ROUND(v_base_amount * 0.09, 2);
    v_igst := 0;
  ELSE
    v_cgst := 0;
    v_sgst := 0;
    v_igst := ROUND(v_base_amount * 0.18, 2);
  END IF;

  v_total_tax := v_cgst + v_sgst + v_igst;
  v_total_amount := v_base_amount + v_total_tax;

  -- Generate invoice number (format: INV-U{YYMM}-{count})
  SELECT 'INV-U' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD((COUNT(*) + 1)::TEXT, 3, '0')
  INTO v_invoice_number
  FROM pro_invoices
  WHERE "influencerId" = v_influencer_id;

  RAISE NOTICE 'Creating invoice: %', v_invoice_number;
  RAISE NOTICE 'Base Amount: %, CGST: %, SGST: %, IGST: %, Total: %',
    v_base_amount, v_cgst, v_sgst, v_igst, v_total_amount;

  -- Create the missing invoice
  INSERT INTO pro_invoices (
    "invoiceNumber",
    "subscriptionId",
    "influencerId",
    amount,
    cgst,
    sgst,
    igst,
    tax,
    "totalAmount",
    "billingPeriodStart",
    "billingPeriodEnd",
    "paymentStatus",
    "paymentMethod",
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_invoice_number,
    v_subscription_id,
    v_influencer_id,
    v_base_amount,
    v_cgst,
    v_sgst,
    v_igst,
    v_total_tax,
    v_total_amount,
    '2026-02-25 14:27:33.268'::TIMESTAMP,
    '2026-03-27 14:27:33.268'::TIMESTAMP,
    'pending',
    'razorpay',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_invoice_id;

  RAISE NOTICE '✅ Invoice created successfully: ID = %, Number = %', v_invoice_id, v_invoice_number;
  RAISE NOTICE '⚠️  Invoice is in PENDING status - user needs to complete payment';
  RAISE NOTICE '📋 User can now proceed to payment page to complete the subscription';

END $$;

-- Verify the invoice was created
SELECT
  id,
  "invoiceNumber",
  "subscriptionId",
  "paymentStatus",
  amount,
  tax,
  "totalAmount",
  "createdAt"
FROM pro_invoices
WHERE "subscriptionId" = 183;
