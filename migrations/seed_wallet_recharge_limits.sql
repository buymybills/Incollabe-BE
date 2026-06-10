-- Migration: Seed Wallet Recharge Limits
-- Description: Insert default recharge limits for brands and influencers
-- Author: System
-- Date: 2026-03-11

BEGIN;

\echo '=== Seeding Wallet Recharge Limits ==='

-- Delete existing records (optional, uncomment if needed)
-- DELETE FROM wallet_recharge_limits;

-- Insert or update recharge limits
INSERT INTO wallet_recharge_limits (user_type, min_recharge_amount, max_recharge_amount, created_at, updated_at)
VALUES
  ('brand', 5000.00, 1000000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('influencer', 0.00, 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (user_type) DO UPDATE SET
  min_recharge_amount = EXCLUDED.min_recharge_amount,
  max_recharge_amount = EXCLUDED.max_recharge_amount,
  updated_at = CURRENT_TIMESTAMP;

\echo '✓ Recharge limits seeded successfully'

-- Verify the data
\echo ''
\echo '=== Current Recharge Limits ==='
SELECT id, user_type, min_recharge_amount, max_recharge_amount, daily_recharge_limit, monthly_recharge_limit
FROM wallet_recharge_limits
ORDER BY user_type;

\echo ''
\echo '=== Migration Complete! ==='

COMMIT;
