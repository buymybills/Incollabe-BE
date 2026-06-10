-- Add overruled tracking to reported_users table
-- Allows admins to overrule reports when reactivating a suspended account
-- Overruled reports are excluded from the auto-suspend threshold count

ALTER TABLE reported_users
  ADD COLUMN IF NOT EXISTS is_overruled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE reported_users
  ADD COLUMN IF NOT EXISTS overruled_at TIMESTAMP WITH TIME ZONE NULL;
