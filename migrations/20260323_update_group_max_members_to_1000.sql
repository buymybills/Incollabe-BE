-- Migration: Update group chat max members from 100 to 1000
-- Date: 2026-03-23
-- Description: Updates all existing group chats to support up to 1000 members instead of 100

-- Update all existing groups that have the old limit of 100 to the new limit of 1000
UPDATE group_chats
SET "maxMembers" = 1000
WHERE "maxMembers" = 100;

-- Verify the update
SELECT
  COUNT(*) as total_groups,
  COUNT(CASE WHEN "maxMembers" = 1000 THEN 1 END) as groups_with_1000_limit,
  COUNT(CASE WHEN "maxMembers" != 1000 THEN 1 END) as groups_with_other_limits
FROM group_chats;
