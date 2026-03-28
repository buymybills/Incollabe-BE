-- Add is_read_by_user column to support_ticket_replies table
-- This tracks whether admin replies have been read by the ticket creator

ALTER TABLE support_ticket_replies
ADD COLUMN IF NOT EXISTS is_read_by_user BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster queries on unread admin replies
-- Note: Column names are camelCase and must be quoted
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_is_read_by_user
ON support_ticket_replies("ticketId", is_read_by_user, "authorType");
