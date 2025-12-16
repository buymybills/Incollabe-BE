-- Chat System Migration
-- Creates tables for conversations and messages between influencers and brands

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  "brandId" INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  "lastMessage" TEXT,
  "lastMessageAt" TIMESTAMP WITH TIME ZONE,
  "lastMessageSenderType" VARCHAR(20),
  "unreadCountInfluencer" INTEGER DEFAULT 0,
  "unreadCountBrand" INTEGER DEFAULT 0,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- Ensure unique conversation per influencer-brand pair
  UNIQUE("influencerId", "brandId")
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  "conversationId" INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "senderType" VARCHAR(20) NOT NULL CHECK ("senderType" IN ('influencer', 'brand')),
  "influencerId" INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
  "brandId" INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  "messageType" VARCHAR(20) DEFAULT 'text' CHECK ("messageType" IN ('text', 'image', 'file')),
  "content" TEXT,
  "attachmentUrl" VARCHAR(500),
  "attachmentName" VARCHAR(255),
  "isRead" BOOLEAN DEFAULT FALSE,
  "readAt" TIMESTAMP WITH TIME ZONE,
  "isDeleted" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_influencer_id ON conversations("influencerId");
CREATE INDEX IF NOT EXISTS idx_conversations_brand_id ON conversations("brandId");
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations("lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations("isActive") WHERE "isActive" = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages("conversationId");
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderType", "influencerId", "brandId");
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages("isRead", "conversationId") WHERE "isRead" = FALSE;

-- Add comments for documentation
COMMENT ON TABLE conversations IS 'Stores one-to-one conversations between influencers and brands';
COMMENT ON TABLE messages IS 'Stores individual messages within conversations';

COMMENT ON COLUMN conversations."lastMessage" IS 'Preview text of the last message sent';
COMMENT ON COLUMN conversations."lastMessageAt" IS 'Timestamp of when the last message was sent';
COMMENT ON COLUMN conversations."lastMessageSenderType" IS 'Who sent the last message (influencer or brand)';
COMMENT ON COLUMN conversations."unreadCountInfluencer" IS 'Number of unread messages for the influencer';
COMMENT ON COLUMN conversations."unreadCountBrand" IS 'Number of unread messages for the brand';

COMMENT ON COLUMN messages."senderType" IS 'Type of user who sent the message (influencer or brand)';
COMMENT ON COLUMN messages."messageType" IS 'Type of message content (text, image, file)';
COMMENT ON COLUMN messages."isRead" IS 'Whether the message has been read by the recipient';
COMMENT ON COLUMN messages."readAt" IS 'Timestamp of when the message was read';
