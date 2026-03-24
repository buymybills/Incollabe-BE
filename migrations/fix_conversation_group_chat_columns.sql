-- Migration: Fix Group Chat Column Naming
-- Date: 2026-03-14
-- Description: Rename camelCase columns to snake_case and consolidate duplicate columns

-- Step 1: Copy data from camelCase columns to snake_case if snake_case doesn't have data
DO $$
BEGIN
  -- Check if group_chat_id column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'group_chat_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN group_chat_id INTEGER;
  END IF;

  -- Copy data from groupChatId to group_chat_id if needed
  UPDATE conversations
  SET group_chat_id = "groupChatId"
  WHERE "groupChatId" IS NOT NULL AND group_chat_id IS NULL;

  -- Update conversation_type from conversationType where needed
  UPDATE conversations
  SET conversation_type = "conversationType"
  WHERE "conversationType" IS NOT NULL
    AND "conversationType" != 'direct'
    AND (conversation_type = 'personal' OR conversation_type IS NULL);
END $$;

-- Step 2: Drop the camelCase columns
ALTER TABLE conversations DROP COLUMN IF EXISTS "groupChatId";
ALTER TABLE conversations DROP COLUMN IF EXISTS "conversationType";

-- Step 3: Add foreign key constraint to group_chat_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversations_group_chat_id_fkey'
  ) THEN
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_group_chat_id_fkey
    FOREIGN KEY (group_chat_id) REFERENCES group_chats(id);
  END IF;
END $$;

-- Step 4: Recreate index on group_chat_id
DROP INDEX IF EXISTS idx_conversations_group;
CREATE INDEX idx_conversations_group ON conversations(group_chat_id) WHERE group_chat_id IS NOT NULL;

-- Step 5: Update check constraint if it references old column names
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS check_group_chat_fields;
ALTER TABLE conversations ADD CONSTRAINT check_group_chat_fields CHECK (
  (conversation_type = 'group' AND group_chat_id IS NOT NULL AND "participant1Type" IS NULL AND "participant1Id" IS NULL AND "participant2Type" IS NULL AND "participant2Id" IS NULL)
  OR
  (conversation_type IN ('direct', 'personal', 'campaign') AND "participant1Type" IS NOT NULL AND "participant1Id" IS NOT NULL AND "participant2Type" IS NOT NULL AND "participant2Id" IS NOT NULL)
);

-- Step 6: Ensure conversation_type has proper check constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_conversationType_check;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversation_type_check;
ALTER TABLE conversations ADD CONSTRAINT conversation_type_check CHECK (conversation_type IN ('direct', 'group', 'personal', 'campaign'));
