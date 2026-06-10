-- Migration: Add isJoinable column to group_chats table (camelCase to match other columns)
-- This allows groups to control whether users can self-join or need admin invitation
-- Date: 2026-03-07

-- Drop old column if it exists (in case migration was run with wrong name)
ALTER TABLE group_chats DROP COLUMN IF EXISTS is_joinable;

-- Add isJoinable column with default value true (camelCase)
ALTER TABLE group_chats
ADD COLUMN IF NOT EXISTS "isJoinable" BOOLEAN DEFAULT true;

-- Update existing groups to be joinable by default (optional)
UPDATE group_chats
SET "isJoinable" = true
WHERE "isJoinable" IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN group_chats."isJoinable" IS 'When true, users can join the group themselves. When false, only admins can add members.';
