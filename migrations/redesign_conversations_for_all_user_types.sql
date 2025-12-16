-- Migration: Redesign conversations to support all user type combinations
-- This allows: influencer-influencer, brand-brand, influencer-brand, brand-influencer

-- Step 1: Add new participant columns (using camelCase to match existing schema)
ALTER TABLE conversations
  ADD COLUMN "participant1Type" VARCHAR(20),
  ADD COLUMN "participant1Id" INTEGER,
  ADD COLUMN "participant2Type" VARCHAR(20),
  ADD COLUMN "participant2Id" INTEGER,
  ADD COLUMN "unreadCountParticipant1" INTEGER DEFAULT 0,
  ADD COLUMN "unreadCountParticipant2" INTEGER DEFAULT 0;

-- Step 2: Migrate existing data
-- Copy existing influencer-brand conversations to new format
UPDATE conversations
SET
  "participant1Type" = 'influencer',
  "participant1Id" = "influencerId",
  "participant2Type" = 'brand',
  "participant2Id" = "brandId",
  "unreadCountParticipant1" = "unreadCountInfluencer",
  "unreadCountParticipant2" = "unreadCountBrand"
WHERE "influencerId" IS NOT NULL AND "brandId" IS NOT NULL;

-- Step 3: Make old columns nullable (for backward compatibility)
ALTER TABLE conversations
  ALTER COLUMN "influencerId" DROP NOT NULL,
  ALTER COLUMN "brandId" DROP NOT NULL;

-- Step 4: Add constraints
ALTER TABLE conversations
  ADD CONSTRAINT check_participant1_type
    CHECK ("participant1Type" IN ('influencer', 'brand'));

ALTER TABLE conversations
  ADD CONSTRAINT check_participant2_type
    CHECK ("participant2Type" IN ('influencer', 'brand'));

ALTER TABLE conversations
  ADD CONSTRAINT check_participant1_id_positive
    CHECK ("participant1Id" > 0);

ALTER TABLE conversations
  ADD CONSTRAINT check_participant2_id_positive
    CHECK ("participant2Id" > 0);

-- Ensure participants are different (can't chat with yourself)
ALTER TABLE conversations
  ADD CONSTRAINT check_different_participants
    CHECK (
      "participant1Type" != "participant2Type"
      OR "participant1Id" != "participant2Id"
    );

-- Step 5: Create indexes for performance
CREATE INDEX idx_conversations_participant1
  ON conversations("participant1Type", "participant1Id");

CREATE INDEX idx_conversations_participant2
  ON conversations("participant2Type", "participant2Id");

-- Composite index for finding conversation between two specific users
CREATE UNIQUE INDEX idx_conversations_unique_participants
  ON conversations(
    LEAST("participant1Type", "participant2Type"),
    LEAST("participant1Id", "participant2Id"),
    GREATEST("participant1Type", "participant2Type"),
    GREATEST("participant1Id", "participant2Id")
  )
  WHERE "isActive" = true;

-- Step 6: Add comment for documentation
COMMENT ON COLUMN conversations."participant1Type" IS 'Type of first participant: influencer or brand';
COMMENT ON COLUMN conversations."participant1Id" IS 'ID of first participant (influencer_id or brand_id)';
COMMENT ON COLUMN conversations."participant2Type" IS 'Type of second participant: influencer or brand';
COMMENT ON COLUMN conversations."participant2Id" IS 'ID of second participant (influencer_id or brand_id)';
COMMENT ON TABLE conversations IS 'Supports conversations between any user types: influencer-influencer, brand-brand, influencer-brand';
