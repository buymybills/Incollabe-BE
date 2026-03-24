-- Safe Migration: Brand-Shared Coupon System with Referral Tracking
-- Description: Idempotent migration that can be run multiple times safely
-- Date: 2026-03-11
-- Author: Claude Code

-- NOTE: This version runs WITHOUT a transaction wrapper, making it more resilient
-- Each step is independent and can succeed even if previous steps already completed

\echo '=== Starting Brand-Shared Coupon Migration (Safe Mode) ==='
\echo ''

-- =============================================================================
-- STEP 1: Create hype_store_referral_codes table
-- =============================================================================
\echo 'Step 1: Creating hype_store_referral_codes table...'

CREATE TABLE IF NOT EXISTS hype_store_referral_codes (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL,
  influencer_id INTEGER NOT NULL,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_referral_code_hype_store
    FOREIGN KEY (hype_store_id)
    REFERENCES hype_stores(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_referral_code_influencer
    FOREIGN KEY (influencer_id)
    REFERENCES influencers(id)
    ON DELETE CASCADE,

  CONSTRAINT unique_influencer_per_store
    UNIQUE (hype_store_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_hype_store_id ON hype_store_referral_codes(hype_store_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_influencer_id ON hype_store_referral_codes(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON hype_store_referral_codes(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON hype_store_referral_codes(is_active);

COMMENT ON TABLE hype_store_referral_codes IS 'Tracks unique referral codes for each influencer per brand.';

\echo '  ✓ hype_store_referral_codes table ready'

-- =============================================================================
-- STEP 2: Create hype_store_referral_clicks table
-- =============================================================================
\echo 'Step 2: Creating hype_store_referral_clicks table...'

CREATE TABLE IF NOT EXISTS hype_store_referral_clicks (
  id SERIAL PRIMARY KEY,
  referral_code_id INTEGER NOT NULL,
  hype_store_id INTEGER NOT NULL,
  influencer_id INTEGER NOT NULL,
  session_id VARCHAR(100),
  customer_ip VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  converted BOOLEAN NOT NULL DEFAULT false,
  order_id INTEGER,
  converted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_click_referral_code
    FOREIGN KEY (referral_code_id)
    REFERENCES hype_store_referral_codes(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_click_hype_store
    FOREIGN KEY (hype_store_id)
    REFERENCES hype_stores(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_click_influencer
    FOREIGN KEY (influencer_id)
    REFERENCES influencers(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_click_order
    FOREIGN KEY (order_id)
    REFERENCES hype_store_orders(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_referral_code_id ON hype_store_referral_clicks(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_hype_store_id ON hype_store_referral_clicks(hype_store_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_influencer_id ON hype_store_referral_clicks(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON hype_store_referral_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_converted ON hype_store_referral_clicks(converted);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_session_id ON hype_store_referral_clicks(session_id);

COMMENT ON TABLE hype_store_referral_clicks IS 'Tracks individual click events on referral links.';

\echo '  ✓ hype_store_referral_clicks table ready'

-- =============================================================================
-- STEP 3: Update hype_store_coupon_codes for brand-shared coupons
-- =============================================================================
\echo 'Step 3: Updating hype_store_coupon_codes table...'

-- Make influencer_id nullable (will not fail if already nullable)
DO $$
BEGIN
  ALTER TABLE hype_store_coupon_codes ALTER COLUMN influencer_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'influencer_id already nullable or error occurred: %', SQLERRM;
END $$;

-- Add is_brand_shared column
ALTER TABLE hype_store_coupon_codes
  ADD COLUMN IF NOT EXISTS is_brand_shared BOOLEAN NOT NULL DEFAULT false;

-- Mark existing coupons as personal (not brand-shared)
DO $$
BEGIN
  UPDATE hype_store_coupon_codes
  SET is_brand_shared = false
  WHERE is_brand_shared IS NULL;
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE 'is_brand_shared column does not exist yet';
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_coupon_codes_brand_shared
  ON hype_store_coupon_codes(is_brand_shared, hype_store_id, is_active);

-- Update comments
COMMENT ON COLUMN hype_store_coupon_codes.influencer_id IS 'Influencer ID for personal coupons. NULL for brand-shared coupons.';
COMMENT ON COLUMN hype_store_coupon_codes.is_brand_shared IS 'If true, this is a brand-shared coupon used by multiple influencers.';

\echo '  ✓ hype_store_coupon_codes table updated'

-- =============================================================================
-- STEP 4: Update hype_store_orders to add referral_code
-- =============================================================================
\echo 'Step 4: Updating hype_store_orders table...'

-- Add referral_code column
ALTER TABLE hype_store_orders
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON hype_store_orders(referral_code);
CREATE INDEX IF NOT EXISTS idx_orders_referral_influencer ON hype_store_orders(referral_code, influencer_id);
CREATE INDEX IF NOT EXISTS idx_orders_referral_status ON hype_store_orders(referral_code, order_status, cashback_status);

-- Add comment
COMMENT ON COLUMN hype_store_orders.referral_code IS 'Referral code used for attribution (e.g., INFL15).';

\echo '  ✓ hype_store_orders table updated'

-- =============================================================================
-- VERIFICATION
-- =============================================================================
\echo ''
\echo '=== Migration Verification ==='

-- Check table existence
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_codes')
    THEN '✓ hype_store_referral_codes exists'
    ELSE '✗ hype_store_referral_codes MISSING'
  END AS referral_codes_check;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_clicks')
    THEN '✓ hype_store_referral_clicks exists'
    ELSE '✗ hype_store_referral_clicks MISSING'
  END AS referral_clicks_check;

-- Check column additions
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hype_store_coupon_codes' AND column_name = 'is_brand_shared')
    THEN '✓ is_brand_shared column added to coupon_codes'
    ELSE '✗ is_brand_shared column MISSING'
  END AS coupon_column_check;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hype_store_orders' AND column_name = 'referral_code')
    THEN '✓ referral_code column added to orders'
    ELSE '✗ referral_code column MISSING'
  END AS order_column_check;

-- Check influencer_id nullable
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hype_store_coupon_codes'
      AND column_name = 'influencer_id'
      AND is_nullable = 'YES'
    )
    THEN '✓ influencer_id is nullable'
    ELSE '✗ influencer_id is NOT NULL'
  END AS nullable_check;

\echo ''
\echo '=== Migration Complete! ==='
\echo 'Brand-shared coupon system with referral tracking is now active.'
\echo ''
\echo 'Next steps:'
\echo '  1. Restart your NestJS application to load new models'
\echo '  2. Test the new API endpoints:'
\echo '     GET /api/influencer/hype-store/:storeId/referral-code'
\echo '     GET /api/influencer/hype-store/:storeId/brand-coupon'
\echo '  3. Update brand webhook integration to send referralCode'
\echo ''
