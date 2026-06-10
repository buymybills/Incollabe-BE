-- Migration: Add Profile View Tracking
-- Description: Adds profile_views table and profileViewsCount columns to track profile page visits

-- Add profileViewsCount to influencers table
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS profile_views_count INTEGER DEFAULT 0 NOT NULL;

-- Add profileViewsCount to brands table
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS profile_views_count INTEGER DEFAULT 0 NOT NULL;

-- Create profile_views table to track who viewed whose profile
CREATE TABLE IF NOT EXISTS profile_views (
  id SERIAL PRIMARY KEY,

  -- Profile being viewed
  viewed_user_type VARCHAR(20) NOT NULL CHECK (viewed_user_type IN ('influencer', 'brand')),
  viewed_influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
  viewed_brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,

  -- Viewer details (who is viewing)
  viewer_type VARCHAR(20) NOT NULL CHECK (viewer_type IN ('influencer', 'brand')),
  viewer_influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
  viewer_brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,

  -- Metadata
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Ensure viewer_type matches the filled ID column
  CONSTRAINT profile_views_viewer_check CHECK (
    (viewer_type = 'influencer' AND viewer_influencer_id IS NOT NULL AND viewer_brand_id IS NULL) OR
    (viewer_type = 'brand' AND viewer_brand_id IS NOT NULL AND viewer_influencer_id IS NULL)
  ),

  -- Ensure viewed_user_type matches the filled ID column
  CONSTRAINT profile_views_viewed_check CHECK (
    (viewed_user_type = 'influencer' AND viewed_influencer_id IS NOT NULL AND viewed_brand_id IS NULL) OR
    (viewed_user_type = 'brand' AND viewed_brand_id IS NOT NULL AND viewed_influencer_id IS NULL)
  )
);

-- Create UNIQUE constraint to ensure each viewer can only have ONE view record per profile (lifetime)
-- This enforces unique counting: User A viewing Profile B = counted only once forever
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_unique_viewer_viewed
ON profile_views(
  viewed_user_type,
  COALESCE(viewed_influencer_id, 0),
  COALESCE(viewed_brand_id, 0),
  viewer_type,
  COALESCE(viewer_influencer_id, 0),
  COALESCE(viewer_brand_id, 0)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_influencer ON profile_views(viewed_influencer_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_brand ON profile_views(viewed_brand_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_influencer ON profile_views(viewer_influencer_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_brand ON profile_views(viewer_brand_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_at ON profile_views(viewed_at DESC);

COMMENT ON TABLE profile_views IS 'Tracks profile page visits - who viewed whose profile and when';
COMMENT ON COLUMN profile_views.viewed_user_type IS 'Type of profile being viewed (influencer or brand)';
COMMENT ON COLUMN profile_views.viewer_type IS 'Type of user viewing the profile (influencer or brand)';
COMMENT ON COLUMN influencers.profile_views_count IS 'Total number of times this influencer profile has been viewed';
COMMENT ON COLUMN brands.profile_views_count IS 'Total number of times this brand profile has been viewed';
