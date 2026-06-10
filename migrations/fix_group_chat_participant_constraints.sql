-- Migration: Fix participant field constraints to allow NULL for group chats
-- Group chats use groupChatId instead of participant fields

-- Step 1: Drop existing constraints that prevent NULL values
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS check_participant1_type,
  DROP CONSTRAINT IF EXISTS check_participant2_type,
  DROP CONSTRAINT IF EXISTS check_participant1_id_positive,
  DROP CONSTRAINT IF EXISTS check_participant2_id_positive,
  DROP CONSTRAINT IF EXISTS check_different_participants;

-- Step 2: Make participant columns explicitly nullable
ALTER TABLE conversations
  ALTER COLUMN "participant1Type" DROP NOT NULL,
  ALTER COLUMN "participant1Id" DROP NOT NULL,
  ALTER COLUMN "participant2Type" DROP NOT NULL,
  ALTER COLUMN "participant2Id" DROP NOT NULL;

-- Step 3: Add new constraints that allow NULL for group chats
-- For personal and campaign conversations, participant fields must be populated
ALTER TABLE conversations
  ADD CONSTRAINT check_participant1_type
    CHECK (
      "participant1Type" IS NULL
      OR "participant1Type" IN ('influencer', 'brand')
    );

ALTER TABLE conversations
  ADD CONSTRAINT check_participant2_type
    CHECK (
      "participant2Type" IS NULL
      OR "participant2Type" IN ('influencer', 'brand')
    );

ALTER TABLE conversations
  ADD CONSTRAINT check_participant1_id_positive
    CHECK (
      "participant1Id" IS NULL
      OR "participant1Id" > 0
    );

ALTER TABLE conversations
  ADD CONSTRAINT check_participant2_id_positive
    CHECK (
      "participant2Id" IS NULL
      OR "participant2Id" > 0
    );

-- Ensure participants are different (can't chat with yourself)
-- Only applies when both participants are set
ALTER TABLE conversations
  ADD CONSTRAINT check_different_participants
    CHECK (
      "participant1Type" IS NULL
      OR "participant2Type" IS NULL
      OR "participant1Type" != "participant2Type"
      OR "participant1Id" != "participant2Id"
    );

-- Step 4: Add constraint to ensure group chats have groupChatId and NULL participants
-- NOTE: Using camelCase column names to match the schema created by add_group_chat_support.sql
ALTER TABLE conversations
  ADD CONSTRAINT check_group_chat_fields
    CHECK (
      ("conversationType" = 'group' AND "groupChatId" IS NOT NULL AND "participant1Type" IS NULL AND "participant1Id" IS NULL AND "participant2Type" IS NULL AND "participant2Id" IS NULL)
      OR ("conversationType" IN ('direct', 'personal', 'campaign') AND "participant1Type" IS NOT NULL AND "participant1Id" IS NOT NULL AND "participant2Type" IS NOT NULL AND "participant2Id" IS NOT NULL)
    );

-- Update any existing group chats to set participant fields to NULL
-- NOTE: Using camelCase column names
UPDATE conversations
SET
  "participant1Type" = NULL,
  "participant1Id" = NULL,
  "participant2Type" = NULL,
  "participant2Id" = NULL
WHERE "conversationType" = 'group' AND "groupChatId" IS NOT NULL;

-- Add comment for documentation
COMMENT ON CONSTRAINT check_group_chat_fields ON conversations IS 'Ensures group chats use groupChatId while personal/campaign chats use participant fields';
