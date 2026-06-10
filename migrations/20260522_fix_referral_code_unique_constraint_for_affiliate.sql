-- Fix: Allow one regular referral code AND one affiliate referral code per influencer per store
-- The original constraint UNIQUE(hype_store_id, influencer_id) blocks creation of an affiliate
-- code when a regular code already exists for the same influencer+store pair.
-- New constraint: UNIQUE(hype_store_id, influencer_id, is_affiliate)

-- Drop the old constraint
ALTER TABLE hype_store_referral_codes
DROP CONSTRAINT IF EXISTS unique_influencer_per_store;

-- Add new constraint that differentiates by is_affiliate flag
ALTER TABLE hype_store_referral_codes
ADD CONSTRAINT unique_influencer_per_store_per_type
  UNIQUE (hype_store_id, influencer_id, is_affiliate);
