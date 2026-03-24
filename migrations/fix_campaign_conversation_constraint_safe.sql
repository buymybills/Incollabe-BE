-- Migration: Fix Campaign Conversation Unique Constraint (SAFE VERSION)
-- Date: 2026-02-26
-- Issue: Campaign conversations fail when influencer-brand pair already has a personal chat
--
-- INSTRUCTIONS:
-- 1. Run the PRE-CHECK section first to identify potential issues
-- 2. Review the output and handle duplicates if any
-- 3. Run the MIGRATION section
-- 4. Keep the ROLLBACK section for emergencies

-- ============================================================================
-- PRE-CHECK: Identify potential issues before migration
-- ============================================================================

-- Check 1: Find duplicate personal conversations (should be 0 rows)
SELECT
  "influencerId",
  "brandId",
  conversation_type,
  COUNT(*) as count,
  array_agg(id) as conversation_ids
FROM conversations
WHERE (conversation_type = 'personal' OR conversation_type IS NULL)
  AND "influencerId" IS NOT NULL
  AND "brandId" IS NOT NULL
GROUP BY "influencerId", "brandId", conversation_type
HAVING COUNT(*) > 1;

-- Check 2: Find duplicate campaign application conversations (should be 0 rows)
SELECT
  campaign_application_id,
  COUNT(*) as count,
  array_agg(id) as conversation_ids
FROM conversations
WHERE campaign_application_id IS NOT NULL
GROUP BY campaign_application_id
HAVING COUNT(*) > 1;

-- Check 3: Count existing conversations by type
SELECT
  conversation_type,
  COUNT(*) as total_conversations
FROM conversations
GROUP BY conversation_type;

-- ============================================================================
-- MIGRATION: Apply the fix
-- ============================================================================

BEGIN;

-- Drop the existing unique constraint
DO $$
BEGIN
  -- Check if constraint exists before dropping
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_influencerId_brandId_key'
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_influencerId_brandId_key;
    RAISE NOTICE 'Dropped constraint: conversations_influencerId_brandId_key';
  ELSE
    RAISE NOTICE 'Constraint conversations_influencerId_brandId_key does not exist, skipping';
  END IF;
END $$;

-- Create partial unique index for personal conversations
-- This allows multiple campaign conversations for the same influencer-brand pair
DROP INDEX IF EXISTS idx_conversations_personal_unique;
CREATE UNIQUE INDEX idx_conversations_personal_unique
ON conversations (
  "influencerId",
  "brandId"
)
WHERE (conversation_type = 'personal' OR conversation_type IS NULL)
  AND "influencerId" IS NOT NULL
  AND "brandId" IS NOT NULL;

-- Create unique index for campaign application conversations
-- Ensures idempotent conversation creation per campaign application
DROP INDEX IF EXISTS idx_conversations_campaign_application_unique;
CREATE UNIQUE INDEX idx_conversations_campaign_application_unique
ON conversations (campaign_application_id)
WHERE campaign_application_id IS NOT NULL;

-- Add helpful comments
COMMENT ON INDEX idx_conversations_personal_unique IS
'Partial unique index: ensures only one personal conversation per influencer-brand pair. Campaign conversations are exempt.';

COMMENT ON INDEX idx_conversations_campaign_application_unique IS
'Unique index: ensures only one conversation per campaign application (idempotent creation).';

-- Commit the transaction
COMMIT;

-- ============================================================================
-- POST-CHECK: Verify migration success
-- ============================================================================

-- Verify indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
  AND (
    indexname = 'idx_conversations_personal_unique'
    OR indexname = 'idx_conversations_campaign_application_unique'
  );

-- ============================================================================
-- ROLLBACK (Run only if you need to revert - NOT for normal execution)
-- ============================================================================

-- DO NOT RUN THIS UNLESS YOU NEED TO ROLLBACK THE MIGRATION
--
-- BEGIN;
--
-- -- Drop the new indexes
-- DROP INDEX IF EXISTS idx_conversations_personal_unique;
-- DROP INDEX IF EXISTS idx_conversations_campaign_application_unique;
--
-- -- Recreate the original unique constraint
-- -- WARNING: This will fail if there are multiple campaign conversations
-- -- for the same influencer-brand pair
-- ALTER TABLE conversations
-- ADD CONSTRAINT conversations_influencerId_brandId_key
-- UNIQUE ("influencerId", "brandId");
--
-- COMMIT;

-- ============================================================================
-- CLEANUP: Remove duplicate campaign application conversations (if any exist)
-- ============================================================================

-- If pre-check found duplicate campaign application conversations,
-- run this to keep only the oldest one:
--
-- WITH duplicates AS (
--   SELECT
--     campaign_application_id,
--     id,
--     ROW_NUMBER() OVER (
--       PARTITION BY campaign_application_id
--       ORDER BY "createdAt" ASC
--     ) as rn
--   FROM conversations
--   WHERE campaign_application_id IS NOT NULL
-- )
-- DELETE FROM conversations
-- WHERE id IN (
--   SELECT id FROM duplicates WHERE rn > 1
-- );
