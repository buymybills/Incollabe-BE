-- Production Database Verification Script
-- Run this on production to check if migrations are needed

-- ==========================================
-- 1. Check support_ticket_replies schema
-- ==========================================

-- Show table structure
\echo '=== Support Ticket Replies Table Structure ==='
\d support_ticket_replies

-- Check if is_read_by_user column exists
\echo ''
\echo '=== Checking is_read_by_user column ==='
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'support_ticket_replies'
  AND column_name = 'is_read_by_user';

-- If no rows returned above, column does NOT exist ❌
-- Expected output: 1 row with column details ✅

-- ==========================================
-- 2. Check indexes
-- ==========================================

\echo ''
\echo '=== Checking indexes on support_ticket_replies ==='
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'support_ticket_replies'
ORDER BY indexname;

-- Expected to see: idx_support_ticket_replies_is_read_by_user

-- ==========================================
-- 3. Check conversations table (campaign chat)
-- ==========================================

\echo ''
\echo '=== Checking conversations table for isCampaignClosed ==='
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('isCampaignClosed', 'campaignClosedAt');

-- Expected: 2 rows (isCampaignClosed and campaignClosedAt should exist)

-- ==========================================
-- 4. Summary
-- ==========================================

\echo ''
\echo '=== SUMMARY ==='
\echo 'Check the output above:'
\echo '1. is_read_by_user column should exist in support_ticket_replies'
\echo '2. Index idx_support_ticket_replies_is_read_by_user should exist'
\echo '3. isCampaignClosed and campaignClosedAt should exist in conversations'
\echo ''
\echo 'If any are missing, run the appropriate migration files.'
