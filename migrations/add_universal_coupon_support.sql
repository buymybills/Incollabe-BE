-- Migration: Add universal coupon support to hype_store_coupon_codes
-- Date: 2026-03-10
-- Description: Optimizes coupon system - one universal coupon per influencer instead of per-store coupons

-- Step 1: Make hype_store_id nullable (for universal coupons)
ALTER TABLE hype_store_coupon_codes
ALTER COLUMN hype_store_id DROP NOT NULL;

-- Step 2: Add is_universal flag
ALTER TABLE hype_store_coupon_codes
ADD COLUMN IF NOT EXISTS is_universal BOOLEAN DEFAULT true;

-- Step 3: Set existing coupons as non-universal (store-specific)
UPDATE hype_store_coupon_codes
SET is_universal = false
WHERE hype_store_id IS NOT NULL;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN hype_store_coupon_codes.is_universal IS 'If true, coupon works for all Hype Stores. If false, only for specific hype_store_id';
COMMENT ON COLUMN hype_store_coupon_codes.hype_store_id IS 'NULL for universal coupons, specific store ID for store-specific coupons';

-- Step 5: Create index for universal coupons
CREATE INDEX IF NOT EXISTS idx_hype_store_coupons_universal
ON hype_store_coupon_codes(influencer_id, is_universal)
WHERE is_universal = true;

-- Step 6: Create unique constraint for universal coupons (one per influencer)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hype_store_coupons_one_universal_per_influencer
ON hype_store_coupon_codes(influencer_id)
WHERE is_universal = true AND is_active = true;

-- Step 7: Update existing unique constraint (now allows duplicates for universal coupons across stores)
-- Note: coupon_code should remain globally unique
-- The existing unique constraint on coupon_code is fine as-is
