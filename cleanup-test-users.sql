-- Cleanup script for load test users
-- Run this AFTER load testing to remove test data

BEGIN;

-- Store counts for verification
SELECT 
  COUNT(*) as total_brands_before,
  COUNT(*) FILTER (WHERE email LIKE 'loadtest%@example.com') as test_brands
FROM brands;

SELECT 
  COUNT(*) as total_influencers_before,
  COUNT(*) FILTER (WHERE email LIKE 'loadtest%@example.com') as test_influencers
FROM influencers;

-- Delete test users (ONLY those created by load tests)
-- Cascading deletes will handle related records (posts, follows, campaigns, etc.)

DELETE FROM brands 
WHERE email LIKE 'loadtest%@example.com'
  AND created_at > NOW() - INTERVAL '1 day'; -- Safety: only recent test users

DELETE FROM influencers 
WHERE email LIKE 'loadtest%@example.com'
  AND created_at > NOW() - INTERVAL '1 day'; -- Safety: only recent test users

-- Verify deletion
SELECT 
  COUNT(*) as total_brands_after,
  COUNT(*) FILTER (WHERE email LIKE 'loadtest%@example.com') as remaining_test_brands
FROM brands;

SELECT 
  COUNT(*) as total_influencers_after,
  COUNT(*) FILTER (WHERE email LIKE 'loadtest%@example.com') as remaining_test_influencers
FROM influencers;

-- Show what was deleted
SELECT 'Cleanup completed successfully' as status;

COMMIT;
-- If anything looks wrong, run: ROLLBACK;
