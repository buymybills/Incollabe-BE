-- Add affiliate link support to HypeStore
-- Influencers can share affiliate links, track purchases, and earn cashback automatically

-- 1. Mark referral codes that are used as affiliate links (vs. brand-shared coupon attribution)
ALTER TABLE hype_store_referral_codes
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN hype_store_referral_codes.is_affiliate IS 'True = this code is an affiliate link; cashback auto-credited after return period (no proof required)';

-- 2. Mark orders that came through an affiliate link (auto-cashback, no proof needed)
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS is_affiliate_purchase BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN hype_store_orders.is_affiliate_purchase IS 'True = order attributed via affiliate link; cashback auto-credited after return period without proof submission';

-- 3. Index for scheduler: efficiently find affiliate orders ready for cashback release
CREATE INDEX IF NOT EXISTS idx_affiliate_cashback_pending
ON hype_store_orders (is_affiliate_purchase, cashback_status, return_period_ends_at, is_returned)
WHERE is_affiliate_purchase = true AND cashback_status = 'pending';
