-- Migration: Fix Campaign Conversation Unique Constraint
-- Date: 2026-02-26
-- Issue: Campaign conversations fail when influencer-brand pair already has a personal chat
--
-- Problem: The unique constraint on (influencerId, brandId) was designed for personal chats,
--          but campaign chats need multiple conversations per influencer-brand pair.
--
-- Solution: Replace the unique constraint with a partial unique index that only applies
--           to personal conversations, allowing multiple campaign conversations.

-- Step 1: Drop the existing unique constraint
-- This constraint prevents multiple conversations between the same influencer-brand pair
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_influencerId_brandId_key;

-- Step 2: Create a partial unique index for personal conversations only
-- This ensures one personal conversation per influencer-brand pair,
-- while allowing multiple campaign conversations
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_personal_unique
ON conversations (
  "influencerId",
  "brandId"
)
WHERE conversation_type = 'personal' OR conversation_type IS NULL;

-- Step 3: Create a unique index for campaign conversations per application
-- This ensures one conversation per campaign application (idempotent creation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_campaign_application_unique
ON conversations (campaign_application_id)
WHERE campaign_application_id IS NOT NULL;

-- Step 4: Add comments for documentation
COMMENT ON INDEX idx_conversations_personal_unique IS
'Ensures only one personal conversation exists per influencer-brand pair. Does not apply to campaign conversations.';

COMMENT ON INDEX idx_conversations_campaign_application_unique IS
'Ensures only one conversation exists per campaign application, supporting idempotent conversation creation.';

-- Verification queries (optional - run manually to verify):
--
-- 1. Check for duplicate personal conversations:
-- SELECT "influencerId", "brandId", COUNT(*)
-- FROM conversations
-- WHERE conversation_type = 'personal'
-- GROUP BY "influencerId", "brandId"
-- HAVING COUNT(*) > 1;
--
-- 2. Check for duplicate campaign application conversations:
-- SELECT campaign_application_id, COUNT(*)
-- FROM conversations
-- WHERE campaign_application_id IS NOT NULL
-- GROUP BY campaign_application_id
-- HAVING COUNT(*) > 1;
