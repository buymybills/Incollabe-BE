-- Migration: Add referral_code to hype_store_orders table
-- Description: Track which referral code was used for attribution in brand-shared coupon orders

-- Step 1: Add referral_code column
ALTER TABLE hype_store_orders
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50);

-- Step 2: Add comment to the column
COMMENT ON COLUMN hype_store_orders.referral_code IS 'Referral code used for attribution (e.g., INFL15). Used with brand-shared coupons to identify which influencer referred the customer.';

-- Step 3: Add index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON hype_store_orders(referral_code);

-- Step 4: Add composite index for common queries (referral code + influencer)
CREATE INDEX IF NOT EXISTS idx_orders_referral_influencer ON hype_store_orders(referral_code, influencer_id);

-- Step 5: Add index for orders by referral code and status
CREATE INDEX IF NOT EXISTS idx_orders_referral_status ON hype_store_orders(referral_code, order_status, cashback_status);

-- Verification query (run this after migration to verify)
-- SELECT
--   id,
--   external_order_id,
--   coupon_code_id,
--   influencer_id,
--   referral_code,
--   order_amount,
--   cashback_amount,
--   order_status,
--   cashback_status,
--   created_at
-- FROM hype_store_orders
-- WHERE referral_code IS NOT NULL
-- ORDER BY created_at DESC
-- LIMIT 10;
