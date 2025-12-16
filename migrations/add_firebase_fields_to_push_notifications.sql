-- Migration: Add Firebase-specific fields to push_notifications table
-- This enables deep linking, rich notifications, and platform-specific settings

-- Add new fields
ALTER TABLE push_notifications
  ADD COLUMN IF NOT EXISTS "internalName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "androidChannelId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sound VARCHAR(20),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "expirationHours" INTEGER,
  ADD COLUMN IF NOT EXISTS "customData" JSONB;

-- Add comments for documentation
COMMENT ON COLUMN push_notifications."internalName" IS 'Internal reference name for admin (not shown to users)';
COMMENT ON COLUMN push_notifications."imageUrl" IS 'Banner/Big Picture URL for rich notifications (HTTPS only, 2:1 ratio recommended)';
COMMENT ON COLUMN push_notifications."actionUrl" IS 'Deep link URL to open specific screen in app (e.g., app://campaigns/123)';
COMMENT ON COLUMN push_notifications."androidChannelId" IS 'Android notification channel ID for categorization';
COMMENT ON COLUMN push_notifications.sound IS 'Notification sound: default, custom, or silent';
COMMENT ON COLUMN push_notifications.priority IS 'Notification priority: high, normal, or low';
COMMENT ON COLUMN push_notifications."expirationHours" IS 'Hours before notification expires (1-168 hours)';
COMMENT ON COLUMN push_notifications."customData" IS 'Custom key-value data for deep linking and app navigation';

-- Add check constraints
ALTER TABLE push_notifications
  ADD CONSTRAINT check_sound_values
    CHECK (sound IS NULL OR sound IN ('default', 'custom', 'silent'));

ALTER TABLE push_notifications
  ADD CONSTRAINT check_priority_values
    CHECK (priority IS NULL OR priority IN ('high', 'normal', 'low'));

ALTER TABLE push_notifications
  ADD CONSTRAINT check_expiration_range
    CHECK ("expirationHours" IS NULL OR ("expirationHours" >= 1 AND "expirationHours" <= 168));

-- Create index on actionUrl for filtering notifications by type
CREATE INDEX IF NOT EXISTS idx_push_notifications_action_url
  ON push_notifications("actionUrl")
  WHERE "actionUrl" IS NOT NULL;

-- Create index on imageUrl to quickly find rich notifications
CREATE INDEX IF NOT EXISTS idx_push_notifications_has_image
  ON push_notifications("imageUrl")
  WHERE "imageUrl" IS NOT NULL;
