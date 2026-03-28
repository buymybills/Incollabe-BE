-- Create in_app_notifications table for notification center
-- This stores persistent notifications that users can view in-app

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id SERIAL PRIMARY KEY,

  -- User identification (polymorphic)
  user_id INTEGER NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('influencer', 'brand')),

  -- Notification content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- e.g., 'campaign_invite', 'campaign_selected', 'payment_received', etc.

  -- Action/Navigation
  action_url TEXT, -- Deep link URL (e.g., 'app://campaigns/123')
  action_type VARCHAR(50), -- e.g., 'view_campaign', 'view_application', 'open_chat'

  -- Media
  image_url TEXT, -- Optional image/icon for the notification

  -- Related entities (for quick lookup)
  related_entity_type VARCHAR(50), -- e.g., 'campaign', 'application', 'payment'
  related_entity_id INTEGER,

  -- Custom data (JSON for flexibility)
  metadata JSONB, -- Any additional data needed by the app

  -- Read status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Priority/Importance
  priority VARCHAR(20) DEFAULT 'normal', -- 'high', 'normal', 'low'

  -- Expiration (optional - notifications can expire after certain time)
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT in_app_notifications_user_idx
    CHECK (user_id > 0)
);

-- Create indexes for fast queries
CREATE INDEX idx_in_app_notifications_user ON in_app_notifications(user_id, user_type);
CREATE INDEX idx_in_app_notifications_read_status ON in_app_notifications(user_id, user_type, is_read);
CREATE INDEX idx_in_app_notifications_created_at ON in_app_notifications(created_at DESC);
CREATE INDEX idx_in_app_notifications_type ON in_app_notifications(type);
CREATE INDEX idx_in_app_notifications_related_entity ON in_app_notifications(related_entity_type, related_entity_id);

-- Add composite index for common query pattern (unread notifications for user)
CREATE INDEX idx_in_app_notifications_unread_user
  ON in_app_notifications(user_id, user_type, is_read, created_at DESC)
  WHERE is_read = false;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_in_app_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_in_app_notifications_updated_at
  BEFORE UPDATE ON in_app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_in_app_notifications_updated_at();

-- Add comments for documentation
COMMENT ON TABLE in_app_notifications IS 'In-app notification center - stores persistent notifications for users to view in the app';
COMMENT ON COLUMN in_app_notifications.user_id IS 'ID of the user (influencer_id or brand_id depending on user_type)';
COMMENT ON COLUMN in_app_notifications.user_type IS 'Type of user: influencer or brand';
COMMENT ON COLUMN in_app_notifications.type IS 'Notification type for categorization and filtering';
COMMENT ON COLUMN in_app_notifications.action_url IS 'Deep link URL to navigate when notification is tapped';
COMMENT ON COLUMN in_app_notifications.metadata IS 'Additional data in JSON format for app consumption';
COMMENT ON COLUMN in_app_notifications.is_read IS 'Whether the notification has been marked as read';
COMMENT ON COLUMN in_app_notifications.expires_at IS 'Optional expiration timestamp - notifications can be auto-deleted after this';
