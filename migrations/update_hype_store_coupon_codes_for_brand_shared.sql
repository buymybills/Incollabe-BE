-- Migration: Update hype_store_coupon_codes table for brand-shared coupons
-- Description: Add support for brand-shared coupons that multiple influencers can use

-- Step 1: Make influencer_id nullable (for brand-shared coupons)
ALTER TABLE hype_store_coupon_codes
  ALTER COLUMN influencer_id DROP NOT NULL;

-- Step 2: Add is_brand_shared column
ALTER TABLE hype_store_coupon_codes
  ADD COLUMN IF NOT EXISTS is_brand_shared BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Add comment to the new column
COMMENT ON COLUMN hype_store_coupon_codes.is_brand_shared IS 'If true, this is a brand-shared coupon (e.g., SNITCHCOLLABKAROO) shared by all influencers. Attribution via referralCode. If false, this is a personal influencer coupon.';

-- Step 4: Update existing coupons to mark them as personal (not brand-shared)
UPDATE hype_store_coupon_codes
SET is_brand_shared = false
WHERE is_brand_shared IS NULL;

-- Step 5: Add index for brand-shared lookups
CREATE INDEX IF NOT EXISTS idx_coupon_codes_brand_shared ON hype_store_coupon_codes(is_brand_shared, hype_store_id, is_active);

-- Step 6: Update comment on influencer_id column
COMMENT ON COLUMN hype_store_coupon_codes.influencer_id IS 'Influencer ID for personal coupons. NULL for brand-shared coupons that use referral tracking.';

-- Verification query (run this after migration to verify)
-- SELECT
--   coupon_code,
--   influencer_id,
--   is_brand_shared,
--   is_universal,
--   hype_store_id,
--   is_active
-- FROM hype_store_coupon_codes
-- ORDER BY created_at DESC
-- LIMIT 10;
