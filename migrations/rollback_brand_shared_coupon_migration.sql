-- Rollback Migration: Brand-Shared Coupon System with Referral Tracking
-- Description: Rollback script to revert brand-shared coupon system changes
-- Date: 2026-03-11
-- Author: Claude Code

-- WARNING: This will drop tables and columns. Make sure you have a backup!

BEGIN;

\echo '=== Starting Rollback ==='
\echo 'WARNING: This will drop tables hype_store_referral_codes and hype_store_referral_clicks'
\echo ''

-- =============================================================================
-- STEP 1: Remove referral_code from hype_store_orders
-- =============================================================================
\echo 'Removing referral_code from hype_store_orders...'

-- Drop indexes first
DROP INDEX IF EXISTS idx_orders_referral_code;
DROP INDEX IF EXISTS idx_orders_referral_influencer;
DROP INDEX IF EXISTS idx_orders_referral_status;

-- Drop column
ALTER TABLE hype_store_orders
  DROP COLUMN IF EXISTS referral_code;

\echo '✓ referral_code removed from hype_store_orders'

-- =============================================================================
-- STEP 2: Remove is_brand_shared from hype_store_coupon_codes
-- =============================================================================
\echo 'Removing is_brand_shared from hype_store_coupon_codes...'

-- Drop index
DROP INDEX IF EXISTS idx_coupon_codes_brand_shared;

-- Drop column
ALTER TABLE hype_store_coupon_codes
  DROP COLUMN IF EXISTS is_brand_shared;

-- Restore NOT NULL constraint on influencer_id
-- NOTE: This will fail if there are any NULL influencer_id values
-- If it fails, you need to either:
-- 1. Delete rows with NULL influencer_id
-- 2. Set influencer_id to a valid value before running this
ALTER TABLE hype_store_coupon_codes
  ALTER COLUMN influencer_id SET NOT NULL;

\echo '✓ is_brand_shared removed from hype_store_coupon_codes'

-- =============================================================================
-- STEP 3: Drop hype_store_referral_clicks table
-- =============================================================================
\echo 'Dropping hype_store_referral_clicks table...'

DROP TABLE IF EXISTS hype_store_referral_clicks CASCADE;

\echo '✓ hype_store_referral_clicks table dropped'

-- =============================================================================
-- STEP 4: Drop hype_store_referral_codes table
-- =============================================================================
\echo 'Dropping hype_store_referral_codes table...'

DROP TABLE IF EXISTS hype_store_referral_codes CASCADE;

\echo '✓ hype_store_referral_codes table dropped'

-- =============================================================================
-- VERIFICATION
-- =============================================================================
\echo ''
\echo '=== Rollback Verification ==='

-- Check tables dropped
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_codes')
    THEN '✓ hype_store_referral_codes dropped'
    ELSE '✗ hype_store_referral_codes still exists'
  END AS referral_codes_check;

SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_clicks')
    THEN '✓ hype_store_referral_clicks dropped'
    ELSE '✗ hype_store_referral_clicks still exists'
  END AS referral_clicks_check;

-- Check columns removed
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hype_store_coupon_codes' AND column_name = 'is_brand_shared')
    THEN '✓ is_brand_shared removed'
    ELSE '✗ is_brand_shared still exists'
  END AS coupon_column_check;

SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hype_store_orders' AND column_name = 'referral_code')
    THEN '✓ referral_code removed'
    ELSE '✗ referral_code still exists'
  END AS order_column_check;

\echo ''
\echo '=== Rollback Complete! ==='
\echo 'Brand-shared coupon system has been reverted.'
\echo ''

COMMIT;
