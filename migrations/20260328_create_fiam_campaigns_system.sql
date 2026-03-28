-- Migration: Create FIAM (Firebase In-App Messaging) Campaign System
-- Date: 2026-03-28
-- Description: Creates tables for rich in-app messaging campaigns with event triggering, targeting, and analytics

-- ============================================================================
-- TABLE 1: fiam_campaigns
-- Main campaign configuration table
-- ============================================================================

CREATE TABLE IF NOT EXISTS fiam_campaigns (
  id SERIAL PRIMARY KEY,

  -- Campaign Metadata
  name VARCHAR(255) NOT NULL,
  internal_name VARCHAR(255), -- Admin reference only
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'expired')),

  priority INTEGER DEFAULT 0, -- Higher priority = shown first when multiple campaigns eligible

  -- Rich UI Configuration (JSONB for flexibility)
  -- Structure: {
  --   layoutType: 'card' | 'modal' | 'banner' | 'top_banner',
  --   backgroundColor: '#FFFFFF',
  --   textColor: '#000000',
  --   title: 'Campaign Title',
  --   body: 'Campaign body text',
  --   imageUrl: 'https://...',
  --   buttonConfig: {
  --     text: 'Shop Now',
  --     actionUrl: 'app://hype-store',
  --     backgroundColor: '#FF5722',
  --     textColor: '#FFFFFF'
  --   },
  --   secondaryButtonConfig: { ... } (optional)
  -- }
  ui_config JSONB NOT NULL,

  -- Trigger Configuration
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('event', 'scheduled')),

  -- For event-triggered campaigns
  -- Array: ['app_open', 'screen_view_campaigns', 'profile_view_self', ...]
  trigger_events JSONB,

  -- For scheduled campaigns (broadcast at specific time)
  scheduled_at TIMESTAMP WITH TIME ZONE,

  -- Targeting Configuration
  -- Array: ['influencer', 'brand'] or null for all
  target_user_types JSONB,

  target_gender VARCHAR(20) CHECK (target_gender IN ('male', 'female', 'others', 'all')),

  target_min_age INTEGER CHECK (target_min_age >= 13 AND target_min_age <= 100),
  target_max_age INTEGER CHECK (target_max_age >= 13 AND target_max_age <= 100),

  -- Array of city names: ['Mumbai', 'Delhi', ...]
  target_locations JSONB,

  target_is_pan_india BOOLEAN DEFAULT false,

  -- Array of niche IDs: [1, 5, 8, ...]
  target_niche_ids JSONB,

  -- Array of specific user IDs to target
  target_specific_user_ids JSONB,

  -- Behavior-based targeting filters
  -- Structure: {
  --   minCampaignApplications: 5,
  --   requiresZeroCredits: true,
  --   hasProSubscription: false,
  --   minFollowerCount: 1000,
  --   maxFollowerCount: 100000
  -- }
  target_behavior_filters JSONB,

  -- Frequency Capping
  -- Structure: {
  --   maxImpressionsPerUser: 3,
  --   maxImpressionsPerDay: 1,
  --   cooldownHours: 24,
  --   globalMaxImpressions: 10000
  -- }
  frequency_config JSONB,

  -- Campaign Lifecycle
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,

  -- Analytics (denormalized for quick access)
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_dismissals INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,

  -- Conversion tracking configuration
  conversion_event VARCHAR(50),
  conversion_window_hours INTEGER DEFAULT 24,

  -- Metadata
  created_by INTEGER NOT NULL REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  internal_notes TEXT -- Admin notes
);

-- ============================================================================
-- INDEXES for fiam_campaigns
-- ============================================================================

-- Status index (filter active/scheduled campaigns)
CREATE INDEX idx_fiam_campaigns_status
  ON fiam_campaigns(status)
  WHERE status IN ('active', 'scheduled');

-- Trigger type and status composite index
CREATE INDEX idx_fiam_campaigns_trigger_type
  ON fiam_campaigns(trigger_type, status);

-- Scheduled campaigns index
CREATE INDEX idx_fiam_campaigns_scheduled_at
  ON fiam_campaigns(scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Priority index (for sorting)
CREATE INDEX idx_fiam_campaigns_priority
  ON fiam_campaigns(priority DESC);

-- Date range index
CREATE INDEX idx_fiam_campaigns_dates
  ON fiam_campaigns(start_date, end_date);

-- Created by admin index
CREATE INDEX idx_fiam_campaigns_created_by
  ON fiam_campaigns(created_by);

-- GIN indexes for JSONB queries
CREATE INDEX idx_fiam_campaigns_trigger_events
  ON fiam_campaigns USING GIN (trigger_events);

CREATE INDEX idx_fiam_campaigns_target_user_types
  ON fiam_campaigns USING GIN (target_user_types);

CREATE INDEX idx_fiam_campaigns_target_niche_ids
  ON fiam_campaigns USING GIN (target_niche_ids);

-- ============================================================================
-- TABLE 2: fiam_campaign_events
-- Track individual user interactions with campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS fiam_campaign_events (
  id SERIAL PRIMARY KEY,

  campaign_id INTEGER NOT NULL REFERENCES fiam_campaigns(id) ON DELETE CASCADE,

  -- User identification
  user_id INTEGER NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('influencer', 'brand')),

  -- Event details
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('impression', 'click', 'dismiss', 'conversion')),

  -- Additional context: { buttonClicked: 'primary', screenName: 'home', ... }
  event_metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Tracking fields
  session_id VARCHAR(100), -- Optional: track user session
  device_type VARCHAR(20) CHECK (device_type IN ('android', 'ios')),
  app_version VARCHAR(20)
);

-- ============================================================================
-- INDEXES for fiam_campaign_events
-- ============================================================================

-- Campaign and user composite index
CREATE INDEX idx_fiam_events_campaign_user
  ON fiam_campaign_events(campaign_id, user_id, user_type);

-- User index (for user-level analytics)
CREATE INDEX idx_fiam_events_user
  ON fiam_campaign_events(user_id, user_type);

-- Event type and timestamp index
CREATE INDEX idx_fiam_events_type
  ON fiam_campaign_events(event_type, created_at DESC);

-- Created at index (for time-based queries)
CREATE INDEX idx_fiam_events_created_at
  ON fiam_campaign_events(created_at DESC);

-- Composite index for frequency capping queries (most important for performance)
CREATE INDEX idx_fiam_events_frequency_check
  ON fiam_campaign_events(campaign_id, user_id, user_type, event_type, created_at)
  WHERE event_type IN ('impression', 'dismiss');

-- Campaign ID index for cascade deletes and analytics
CREATE INDEX idx_fiam_events_campaign_id
  ON fiam_campaign_events(campaign_id);

-- ============================================================================
-- COMMENTS (PostgreSQL documentation)
-- ============================================================================

COMMENT ON TABLE fiam_campaigns IS 'Firebase In-App Messaging style campaigns with rich UI and advanced targeting';
COMMENT ON TABLE fiam_campaign_events IS 'User interaction events with FIAM campaigns for analytics and frequency capping';

COMMENT ON COLUMN fiam_campaigns.ui_config IS 'JSONB containing layout type, colors, title, body, image, and button configurations';
COMMENT ON COLUMN fiam_campaigns.trigger_events IS 'Array of event names that trigger this campaign (for event-triggered campaigns)';
COMMENT ON COLUMN fiam_campaigns.frequency_config IS 'JSONB containing frequency capping rules (maxImpressionsPerUser, cooldownHours, etc.)';
COMMENT ON COLUMN fiam_campaigns.target_behavior_filters IS 'JSONB containing behavior-based targeting rules (minCampaignApplications, hasProSubscription, etc.)';

COMMENT ON COLUMN fiam_campaign_events.event_type IS 'Type of interaction: impression (shown), click (button clicked), dismiss (closed), conversion (goal completed)';
COMMENT ON COLUMN fiam_campaign_events.event_metadata IS 'JSONB containing additional context about the event';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('fiam_campaigns', 'fiam_campaign_events')
ORDER BY table_name;

-- Verify indexes were created
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('fiam_campaigns', 'fiam_campaign_events')
ORDER BY tablename, indexname;

-- Show table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fiam_campaigns'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fiam_campaign_events'
ORDER BY ordinal_position;
