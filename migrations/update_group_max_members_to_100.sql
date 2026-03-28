-- Migration: Update maxMembers for group_chats from 10 to 100
-- This increases the group capacity to support larger communities
-- Date: 2026-03-07

-- Update existing groups to have max 100 members
UPDATE group_chats
SET "maxMembers" = 100
WHERE "maxMembers" = 10;

-- Optionally update the default value for the column
ALTER TABLE group_chats
ALTER COLUMN "maxMembers" SET DEFAULT 100;

-- Add comment to document the change
COMMENT ON COLUMN group_chats."maxMembers" IS 'Maximum number of members allowed in the group (default: 100)';
