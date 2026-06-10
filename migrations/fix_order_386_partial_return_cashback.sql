-- Fix order 386 (NN1028SO) partial return cashback
-- 499 INR item was returned out of 1248 INR total, original cashback was 312 INR
-- cashbackReversed = 312 * (499/1248) = 124.74
-- remainingCashback = 312 - 124.74 = 187.26

DO $$
DECLARE
  v_order_id INTEGER := 386;
  v_original_cashback NUMERIC := 312;
  v_return_amount NUMERIC := 499;
  v_order_amount NUMERIC := 1248;
  v_reversed_cashback NUMERIC;
  v_remaining_cashback NUMERIC;
  v_locked_tx_id INTEGER;
BEGIN
  v_reversed_cashback := ROUND((v_original_cashback * v_return_amount / v_order_amount)::NUMERIC, 2);
  v_remaining_cashback := ROUND((v_original_cashback - v_reversed_cashback)::NUMERIC, 2);

  RAISE NOTICE 'Reversed cashback: %, Remaining cashback: %', v_reversed_cashback, v_remaining_cashback;

  -- Update order cashback_amount to remaining
  UPDATE hype_store_orders
  SET cashback_amount = v_remaining_cashback,
      updated_at = NOW()
  WHERE id = v_order_id
    AND order_status = 'partial_return';

  RAISE NOTICE 'Updated order % cashback_amount to %', v_order_id, v_remaining_cashback;

  -- Get the locked cashback transaction id
  SELECT locked_cashback_transaction_id INTO v_locked_tx_id
  FROM hype_store_orders WHERE id = v_order_id;

  IF v_locked_tx_id IS NOT NULL THEN
    -- Reduce locked transaction amount to remaining cashback so cron credits correct amount
    UPDATE wallet_transactions
    SET amount = v_remaining_cashback,
        notes = CONCAT('Partial return fix: reversed ₹', v_reversed_cashback, ', remaining ₹', v_remaining_cashback),
        updated_at = NOW()
    WHERE id = v_locked_tx_id
      AND is_locked = true;

    RAISE NOTICE 'Updated locked transaction % amount to %', v_locked_tx_id, v_remaining_cashback;
  ELSE
    RAISE NOTICE 'No locked transaction found for order %', v_order_id;
  END IF;
END $$;
