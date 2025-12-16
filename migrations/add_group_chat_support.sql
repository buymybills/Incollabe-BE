-- Migration: Add Group Chat Support
-- Date: 2025-12-12
-- Description: Adds tables and fields for group chat functionality with E2EE support

-- Create group_chats table
CREATE TABLE IF NOT EXISTS group_chats (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  "avatarUrl" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdByType" VARCHAR(20) NOT NULL CHECK ("createdByType" IN ('influencer', 'brand', 'admin')),
  "maxMembers" INTEGER DEFAULT 10,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group_members table (junction table for group membership)
CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  "groupChatId" INTEGER NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  "memberId" INTEGER NOT NULL,
  "memberType" VARCHAR(20) NOT NULL CHECK ("memberType" IN ('influencer', 'brand', 'admin')),
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastReadMessageId" INTEGER,
  "leftAt" TIMESTAMP,

  -- Prevent duplicate memberships
  CONSTRAINT unique_group_membership UNIQUE ("groupChatId", "memberId", "memberType")
);

-- Add indexes for group_members (optimized for common queries)
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members("groupChatId", "leftAt");
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members("memberId", "memberType");

-- Add group fields to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS "groupChatId" INTEGER REFERENCES group_chats(id),
ADD COLUMN IF NOT EXISTS "conversationType" VARCHAR(20) DEFAULT 'direct' CHECK ("conversationType" IN ('direct', 'group'));

-- Create index for group conversations
CREATE INDEX IF NOT EXISTS idx_conversations_group ON conversations("groupChatId") WHERE "groupChatId" IS NOT NULL;

-- Add sender fields to messages table (for identifying sender in group chats)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS "senderId" INTEGER,
ADD COLUMN IF NOT EXISTS "senderType" VARCHAR(20) CHECK ("senderType" IN ('influencer', 'brand', 'admin'));

-- Create index for message sender (optimized for group message queries)
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderId", "senderType") WHERE "senderId" IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE group_chats IS 'Stores group chat metadata including name, avatar, and settings';
COMMENT ON TABLE group_members IS 'Junction table for group memberships with role tracking and unread message tracking';
COMMENT ON COLUMN group_chats.name IS 'Display name of the group (max 100 characters)';
COMMENT ON COLUMN group_chats."avatarUrl" IS 'URL to group avatar image';
COMMENT ON COLUMN group_chats."createdById" IS 'User ID of the group creator';
COMMENT ON COLUMN group_chats."createdByType" IS 'User type of the group creator (influencer/brand/admin)';
COMMENT ON COLUMN group_chats."maxMembers" IS 'Maximum number of members allowed in this group (default 10)';
COMMENT ON COLUMN group_chats."isActive" IS 'Whether the group is active (false if all members have left)';
COMMENT ON COLUMN group_members."groupChatId" IS 'Foreign key to group_chats table';
COMMENT ON COLUMN group_members."memberId" IS 'User ID of the group member';
COMMENT ON COLUMN group_members."memberType" IS 'User type of the member (influencer/brand/admin)';
COMMENT ON COLUMN group_members.role IS 'Member role: admin (creator) or member';
COMMENT ON COLUMN group_members."joinedAt" IS 'Timestamp when member joined the group';
COMMENT ON COLUMN group_members."lastReadMessageId" IS 'ID of the last message read by this member (for unread count)';
COMMENT ON COLUMN group_members."leftAt" IS 'Timestamp when member left the group (NULL if active member)';
COMMENT ON COLUMN conversations."conversationType" IS 'Type of conversation: direct (1-to-1) or group';
COMMENT ON COLUMN conversations."groupChatId" IS 'Foreign key to group_chats table (NULL for direct conversations)';
COMMENT ON COLUMN messages."senderId" IS 'For group messages: ID of the sender';
COMMENT ON COLUMN messages."senderType" IS 'For group messages: Type of the sender (influencer/brand/admin)';
