-- Migration: Add Instagram OAuth fields to influencers and brands tables
-- Created: 2025-12-06
-- Description: Adds Instagram authentication and profile data fields for both influencers and brands

-- Add Instagram OAuth fields to influencers table
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
  ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instagram_account_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS instagram_followers_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_follows_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_media_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_bio TEXT,
  ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS instagram_access_token_hash VARCHAR(255);

-- Add index for faster lookups by Instagram user ID (influencers)
CREATE INDEX IF NOT EXISTS idx_influencers_instagram_user_id
  ON influencers(instagram_user_id);

-- Add index for Instagram username (influencers)
CREATE INDEX IF NOT EXISTS idx_influencers_instagram_username
  ON influencers(instagram_username);

-- Add Instagram OAuth fields to brands table
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
  ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instagram_account_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS instagram_followers_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_follows_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_media_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_bio TEXT,
  ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS instagram_access_token_hash VARCHAR(255);

-- Add index for faster lookups by Instagram user ID (brands)
CREATE INDEX IF NOT EXISTS idx_brands_instagram_user_id
  ON brands(instagram_user_id);

-- Add index for Instagram username (brands)
CREATE INDEX IF NOT EXISTS idx_brands_instagram_username
  ON brands(instagram_username);

-- Comments for documentation
COMMENT ON COLUMN influencers.instagram_access_token IS 'Encrypted Instagram OAuth access token';
COMMENT ON COLUMN influencers.instagram_user_id IS 'Instagram user ID from OAuth';
COMMENT ON COLUMN influencers.instagram_username IS 'Instagram username from profile';
COMMENT ON COLUMN influencers.instagram_account_type IS 'Instagram account type (BUSINESS, CREATOR, etc.)';
COMMENT ON COLUMN influencers.instagram_token_expires_at IS 'Expiration timestamp for Instagram access token';
COMMENT ON COLUMN influencers.instagram_connected_at IS 'Timestamp when Instagram was first connected';
COMMENT ON COLUMN influencers.instagram_access_token_hash IS 'SHA-256 hash of access token for indexing';

COMMENT ON COLUMN brands.instagram_access_token IS 'Encrypted Instagram OAuth access token';
COMMENT ON COLUMN brands.instagram_user_id IS 'Instagram user ID from OAuth';
COMMENT ON COLUMN brands.instagram_username IS 'Instagram username from profile';
COMMENT ON COLUMN brands.instagram_account_type IS 'Instagram account type (BUSINESS, CREATOR, etc.)';
COMMENT ON COLUMN brands.instagram_token_expires_at IS 'Expiration timestamp for Instagram access token';
COMMENT ON COLUMN brands.instagram_connected_at IS 'Timestamp when Instagram was first connected';
COMMENT ON COLUMN brands.instagram_access_token_hash IS 'SHA-256 hash of access token for indexing';
