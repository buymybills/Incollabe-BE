-- Add reply_to_message_id column to messages table for WhatsApp-style reply functionality
-- Migration: 20260327_add_reply_to_message_id

-- Add the reply_to_message_id column
ALTER TABLE messages
ADD COLUMN reply_to_message_id INTEGER NULL;

-- Add foreign key constraint to reference the messages table
ALTER TABLE messages
ADD CONSTRAINT fk_messages_reply_to_message
FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Add index for better query performance when fetching replied messages
CREATE INDEX idx_messages_reply_to_message_id ON messages(reply_to_message_id);

-- Add comment for documentation
COMMENT ON COLUMN messages.reply_to_message_id IS 'ID of the message being replied to (WhatsApp-style reply feature)';
