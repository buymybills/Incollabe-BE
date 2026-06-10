-- Migration: Add content_type column to hype_store_cashback_tiers table
-- Purpose: Support different cashback rates for REEL (permanent posts) vs STORY (24-hour stories)
-- Date: 2026-03-19

-- Add content_type column to hype_store_cashback_tiers table
ALTER TABLE hype_store_cashback_tiers
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN hype_store_cashback_tiers.content_type IS 'Content type for tier: REEL (permanent posts/reels with higher cashback), STORY (24-hour stories with lower cashback), or NO_CONTENT (no proof submitted, 7% flat). NULL for legacy tiers that apply to both.';

-- Create index for efficient querying by content type
CREATE INDEX IF NOT EXISTS idx_cashback_tiers_content_type
ON hype_store_cashback_tiers(hype_store_id, content_type, is_active)
WHERE is_active = TRUE;

-- Add check constraint to ensure valid content types
ALTER TABLE hype_store_cashback_tiers
ADD CONSTRAINT IF NOT EXISTS chk_content_type
CHECK (content_type IN ('REEL', 'STORY', 'NO_CONTENT') OR content_type IS NULL);
