-- Migration: Add Broadcast Mode to Group Chats
-- Date: 2026-03-05
-- Description: Adds isBroadcastOnly field to support both broadcast-only and regular group chats

-- Add isBroadcastOnly field to group_chats table
ALTER TABLE group_chats
ADD COLUMN IF NOT EXISTS is_broadcast_only BOOLEAN DEFAULT FALSE;

-- Create index for filtering broadcast groups
CREATE INDEX IF NOT EXISTS idx_group_chats_broadcast ON group_chats(is_broadcast_only);

-- Add comment for documentation
COMMENT ON COLUMN group_chats.is_broadcast_only IS 'When true, only admins can send messages (broadcast/announcement mode). When false, any member can send messages (regular group chat).';
