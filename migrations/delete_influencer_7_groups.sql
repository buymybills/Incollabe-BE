-- Delete groups for influencer 7 (IDs: 2, 3, 4, 5, 6)
-- These are test groups with only one member

-- First, verify the groups belong to influencer 7 and they're the only member
SELECT
  gc.id,
  gc.name,
  gc."createdById",
  gc."createdByType",
  COUNT(gm.id) as member_count
FROM group_chats gc
LEFT JOIN group_members gm ON gc.id = gm."groupChatId" AND gm."leftAt" IS NULL
WHERE gc.id IN (2, 3, 4, 5, 6)
GROUP BY gc.id, gc.name, gc."createdById", gc."createdByType";

-- Delete messages in these group conversations
DELETE FROM messages
WHERE "conversationId" IN (
  SELECT id FROM conversations WHERE "group_chat_id" IN (2, 3, 4, 5, 6)
);

-- Delete conversations for these groups
DELETE FROM conversations
WHERE "group_chat_id" IN (2, 3, 4, 5, 6);

-- Delete group members (though CASCADE would handle this)
DELETE FROM group_members
WHERE "groupChatId" IN (2, 3, 4, 5, 6);

-- Finally, delete the groups themselves
DELETE FROM group_chats
WHERE id IN (2, 3, 4, 5, 6)
  AND "createdById" = 7
  AND "createdByType" = 'influencer';

-- Verify deletion
SELECT
  'Groups remaining for influencer 7:' as info,
  COUNT(*) as count
FROM group_chats gc
JOIN group_members gm ON gc.id = gm."groupChatId"
WHERE gm."memberId" = 7
  AND gm."memberType" = 'influencer'
  AND gm."leftAt" IS NULL;
