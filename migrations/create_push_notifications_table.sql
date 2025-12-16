-- Migration: Add Push Notifications table
-- Date: 2025-10-29
-- Description: Creates push_notifications table for admin notification management

-- Create enum types
CREATE TYPE notification_status AS ENUM ('draft', 'scheduled', 'sent', 'failed');
CREATE TYPE receiver_type AS ENUM ('all_users', 'all_influencers', 'all_brands', 'brands', 'influencers', 'specific_users');
CREATE TYPE gender_filter AS ENUM ('male', 'female', 'others', 'all');

-- Create push_notifications table
CREATE TABLE IF NOT EXISTS push_notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  "receiverType" receiver_type NOT NULL DEFAULT 'all_users',
  "specificReceivers" JSON,
  locations JSON,
  "genderFilter" gender_filter DEFAULT 'all',
  "minAge" INTEGER,
  "maxAge" INTEGER,
  "nicheIds" JSON,
  "isPanIndia" BOOLEAN DEFAULT FALSE,
  status notification_status NOT NULL DEFAULT 'draft',
  "scheduledAt" TIMESTAMP WITH TIME ZONE,
  "sentAt" TIMESTAMP WITH TIME ZONE,
  "totalRecipients" INTEGER,
  "successCount" INTEGER,
  "failureCount" INTEGER,
  metadata JSON,
  "createdBy" INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_status 
ON push_notifications (status);

CREATE INDEX IF NOT EXISTS idx_push_notifications_receiver_type 
ON push_notifications ("receiverType");

CREATE INDEX IF NOT EXISTS idx_push_notifications_scheduled_at 
ON push_notifications ("scheduledAt");

CREATE INDEX IF NOT EXISTS idx_push_notifications_created_by 
ON push_notifications ("createdBy");

CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at 
ON push_notifications ("createdAt" DESC);

-- Add comments
COMMENT ON TABLE push_notifications IS 'Stores push notification campaigns created by admins';
COMMENT ON COLUMN push_notifications.title IS 'Notification title shown to users';
COMMENT ON COLUMN push_notifications.body IS 'Notification message content';
COMMENT ON COLUMN push_notifications."receiverType" IS 'Type of target audience';
COMMENT ON COLUMN push_notifications."specificReceivers" IS 'Array of user IDs when targeting specific users';
COMMENT ON COLUMN push_notifications.locations IS 'Array of city names for location-based targeting';
COMMENT ON COLUMN push_notifications."genderFilter" IS 'Gender filter for targeting (male, female, others, all)';
COMMENT ON COLUMN push_notifications."minAge" IS 'Minimum age for targeting recipients';
COMMENT ON COLUMN push_notifications."maxAge" IS 'Maximum age for targeting recipients';
COMMENT ON COLUMN push_notifications."nicheIds" IS 'Array of niche IDs for targeting specific niches';
COMMENT ON COLUMN push_notifications."isPanIndia" IS 'Whether to target all of India';
COMMENT ON COLUMN push_notifications.status IS 'Current status of the notification';
COMMENT ON COLUMN push_notifications."scheduledAt" IS 'When the notification is scheduled to be sent';
COMMENT ON COLUMN push_notifications."sentAt" IS 'When the notification was actually sent';
COMMENT ON COLUMN push_notifications."totalRecipients" IS 'Total number of recipients';
COMMENT ON COLUMN push_notifications."successCount" IS 'Number of successful deliveries';
COMMENT ON COLUMN push_notifications."failureCount" IS 'Number of failed deliveries';
COMMENT ON COLUMN push_notifications.metadata IS 'Additional data like image URL, action URL, etc.';
