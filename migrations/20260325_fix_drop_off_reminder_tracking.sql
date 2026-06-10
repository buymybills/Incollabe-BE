-- Fix Drop-off Reminder Tracking
-- Replace single reminderSentAt with separate 1h and 6h tracking
-- This allows sending BOTH reminders instead of just one

-- Add new separate tracking fields
ALTER TABLE pro_subscriptions
ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_6h_sent_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing reminderSentAt data to reminder_1h_sent_at
-- (Assume any existing reminderSentAt was the 1h reminder)
UPDATE pro_subscriptions
SET reminder_1h_sent_at = reminder_sent_at
WHERE reminder_sent_at IS NOT NULL;

-- Drop old field (optional - can keep for backward compatibility)
-- ALTER TABLE pro_subscriptions DROP COLUMN IF EXISTS reminder_sent_at;

-- Add comment for documentation
COMMENT ON COLUMN pro_subscriptions.reminder_1h_sent_at IS 'Timestamp when 1-hour payment drop-off reminder was sent';
COMMENT ON COLUMN pro_subscriptions.reminder_6h_sent_at IS 'Timestamp when 6-hour payment drop-off reminder was sent';
