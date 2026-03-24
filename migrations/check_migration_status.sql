-- Check Migration Status: Brand-Shared Coupon System
-- Description: Verify which parts of the migration have been applied

\echo '=== Checking Migration Status ==='
\echo ''

-- Check if hype_store_referral_codes table exists
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_codes')
    THEN '✓ hype_store_referral_codes table EXISTS'
    ELSE '✗ hype_store_referral_codes table MISSING'
  END AS table_check;

-- Check if hype_store_referral_clicks table exists
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_clicks')
    THEN '✓ hype_store_referral_clicks table EXISTS'
    ELSE '✗ hype_store_referral_clicks table MISSING'
  END AS table_check;

-- Check if is_brand_shared column exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hype_store_coupon_codes'
      AND column_name = 'is_brand_shared'
    )
    THEN '✓ is_brand_shared column EXISTS in hype_store_coupon_codes'
    ELSE '✗ is_brand_shared column MISSING in hype_store_coupon_codes'
  END AS column_check;

-- Check if referral_code column exists in orders
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hype_store_orders'
      AND column_name = 'referral_code'
    )
    THEN '✓ referral_code column EXISTS in hype_store_orders'
    ELSE '✗ referral_code column MISSING in hype_store_orders'
  END AS column_check;

-- Check if influencer_id is nullable in hype_store_coupon_codes
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hype_store_coupon_codes'
      AND column_name = 'influencer_id'
      AND is_nullable = 'YES'
    )
    THEN '✓ influencer_id is NULLABLE in hype_store_coupon_codes'
    ELSE '✗ influencer_id is NOT NULL in hype_store_coupon_codes'
  END AS nullable_check;

-- Count existing data
\echo ''
\echo '=== Data Counts ==='

SELECT
  COALESCE(COUNT(*), 0) as referral_codes_count
FROM information_schema.tables
WHERE table_name = 'hype_store_referral_codes'
AND table_schema = 'public';

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_codes')
    THEN (SELECT COUNT(*) FROM hype_store_referral_codes)
    ELSE 0
  END as referral_codes_rows;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_referral_clicks')
    THEN (SELECT COUNT(*) FROM hype_store_referral_clicks)
    ELSE 0
  END as referral_clicks_rows;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hype_store_coupon_codes'
      AND column_name = 'is_brand_shared'
    )
    THEN (SELECT COUNT(*) FROM hype_store_coupon_codes WHERE is_brand_shared = true)
    ELSE 0
  END as brand_shared_coupons_count;

\echo ''
\echo '=== Index Status ==='

-- Check which indexes exist
SELECT
  indexname,
  CASE
    WHEN indexname IS NOT NULL THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM pg_indexes
WHERE tablename IN ('hype_store_referral_codes', 'hype_store_referral_clicks', 'hype_store_coupon_codes', 'hype_store_orders')
  AND indexname LIKE '%referral%'
ORDER BY tablename, indexname;

\echo ''
\echo '=== Summary ==='
\echo 'Run this to determine next steps:'
\echo '  - If tables are MISSING: Run the full migration'
\echo '  - If tables are PARTIAL: Rollback first, then run migration'
\echo '  - If all ✓: Migration already complete!'
\echo ''
