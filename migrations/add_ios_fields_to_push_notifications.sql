-- Add iOS-specific fields to push_notifications table
-- Run this migration to add badge, threadId, and interruptionLevel columns
-- PostgreSQL version

ALTER TABLE push_notifications
ADD COLUMN badge INTEGER NULL,
ADD COLUMN thread_id VARCHAR(255) NULL,
ADD COLUMN interruption_level VARCHAR(20) NULL;

-- Add comments to the columns (PostgreSQL syntax)
COMMENT ON COLUMN push_notifications.badge IS 'iOS badge count (red number on app icon)';
COMMENT ON COLUMN push_notifications.thread_id IS 'iOS thread identifier for grouping related notifications';
COMMENT ON COLUMN push_notifications.interruption_level IS 'iOS interruption level: passive, active, timeSensitive, critical';

-- Add index for thread_id for better query performance when grouping notifications
CREATE INDEX IF NOT EXISTS idx_push_notifications_thread_id ON push_notifications(thread_id);

-- Add comment to the table
COMMENT ON TABLE push_notifications IS 'Push notifications with iOS and Android support';
