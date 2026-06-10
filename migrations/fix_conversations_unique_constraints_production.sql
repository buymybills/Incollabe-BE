-- ============================================================
-- Fix Conversations Unique Constraints for Campaign Chat
-- Issue: Old unique constraint prevents campaign conversations
-- Solution: Make unique constraint only apply to personal chats
-- ============================================================

-- STEP 1: Check current unique indexes
\echo '=== Current UNIQUE indexes on conversations ==='
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

\echo ''
\echo 'Expected to see:'
\echo '  - conversations_pkey (primary key - OK)'
\echo '  - idx_conversations_campaign_application_unique (campaign chats - OK)'
\echo '  - idx_conversations_personal_unique (legacy personal chats - OK)'
\echo '  - idx_conversations_unique_participants_personal (NEW - personal only)'
\echo ''
\echo 'Should NOT see:'
\echo '  - idx_conversations_unique_participants (OLD - blocks campaign chats)'
\echo ''

-- STEP 2: Drop the problematic index if it exists
\echo '=== Dropping old index that blocks campaign chats ==='
DROP INDEX IF EXISTS idx_conversations_unique_participants;

-- STEP 3: Create the correct index (only for personal conversations)
\echo '=== Creating new index for personal chats only ==='
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_participants_personal
ON conversations (
  LEAST("participant1Type", "participant2Type"),
  LEAST("participant1Id", "participant2Id"),
  GREATEST("participant1Type", "participant2Type"),
  GREATEST("participant1Id", "participant2Id")
)
WHERE (conversation_type = 'personal' OR conversation_type IS NULL)
  AND "isActive" = true;

-- STEP 4: Clean up duplicate campaign_application indexes (optional)
\echo '=== Cleaning up duplicate campaign_application indexes ==='
DROP INDEX IF EXISTS idx_conversations_campaign_application;
-- Keep idx_conversations_campaign_application_unique (it's the newer one)

-- STEP 5: Verify the fix
\echo ''
\echo '=== FINAL VERIFICATION ==='
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

\echo ''
\echo '=========================================='
\echo 'SUMMARY'
\echo '=========================================='
\echo 'Fixed: Unique constraint now only applies to personal conversations'
\echo 'Result: Multiple campaign conversations are now allowed'
\echo '=========================================='
