-- Migration: Fix conversations table by removing old unique constraint
-- The old unique constraint on (influencerId, brandId) doesn't work with new participant-based system
-- where we can have influencer-influencer or brand-brand conversations

-- Drop the old unique constraint
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS "conversations_influencerId_brandId_key";

-- The new unique index idx_conversations_unique_participants already handles uniqueness
-- for all participant combinations, so we don't need the old constraint

-- Add comment for documentation
COMMENT ON INDEX idx_conversations_unique_participants IS
  'Ensures uniqueness for all conversation participant combinations (influencer-influencer, brand-brand, influencer-brand)';
