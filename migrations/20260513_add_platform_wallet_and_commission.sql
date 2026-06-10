-- Migration: Add platform wallet support and affiliate commission split
-- Date: 2026-05-13
-- Adds PLATFORM user type, PLATFORM_COMMISSION transaction type,
-- platform_commission_amount on orders, and creates the platform wallet.

-- 1. Add 'platform' to wallets user_type enum
ALTER TYPE user_type_enum ADD VALUE IF NOT EXISTS 'platform';

-- 2. Add 'platform_commission' to wallet_transactions transaction_type enum
ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'platform_commission';

-- 3. Add platform_commission_amount column to hype_store_orders
ALTER TABLE hype_store_orders
  ADD COLUMN IF NOT EXISTS platform_commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0
  CHECK (platform_commission_amount >= 0);

COMMENT ON COLUMN hype_store_orders.platform_commission_amount
  IS 'Platform commission (40% of cashback amount) for affiliate orders';

-- 4. Add is_affiliate flag to hype_store_referral_codes
ALTER TABLE hype_store_referral_codes
  ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN hype_store_referral_codes.is_affiliate
  IS 'Whether this referral code is used for affiliate link (no content required, flat 10% cashback)';

-- 5. Allow 'affiliate' as a content_type value on hype_store_orders
-- (column is VARCHAR so no enum change needed, just documenting the new valid value)
COMMENT ON COLUMN hype_store_orders.content_type
  IS 'Content type for cashback calculation: story, post_reel, or affiliate';

-- 5. Create the platform wallet (one-time singleton, userId = 0)
INSERT INTO wallets (user_id, user_type, balance, total_credited, total_debited, total_cashback_received, total_redeemed, locked_amount, is_active, created_at, updated_at)
VALUES (0, 'platform', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
