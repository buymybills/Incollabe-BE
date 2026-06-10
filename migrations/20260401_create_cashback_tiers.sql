-- Create Cashback Tiers table for follower-based cashback system
-- This table stores tier configurations for different follower ranges and content types

CREATE TABLE IF NOT EXISTS cashback_tiers (
  id SERIAL PRIMARY KEY,

  -- Follower range
  min_followers INTEGER NOT NULL,
  max_followers INTEGER, -- NULL means unlimited

  -- Content type (story or post_reel)
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('story', 'post_reel')),

  -- Cashback percentage (e.g., 25.00 = 25%)
  cashback_percentage DECIMAL(5, 2) NOT NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_cashback_tiers_followers ON cashback_tiers(min_followers, max_followers);
CREATE INDEX idx_cashback_tiers_content ON cashback_tiers(content_type);
CREATE INDEX idx_cashback_tiers_active ON cashback_tiers(is_active);

-- Add comment
COMMENT ON TABLE cashback_tiers IS 'Cashback tier configurations based on influencer follower count and content type';

-- ============================================================================
-- Seed data: All 13 follower ranges
-- ============================================================================

-- 1-499 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(1, 499, 'story', 10.00),
(1, 499, 'post_reel', 25.00);

-- 500-999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(500, 999, 'story', 15.00),
(500, 999, 'post_reel', 30.00);

-- 1,000-9,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(1000, 9999, 'story', 20.00),
(1000, 9999, 'post_reel', 40.00);

-- 10,000-19,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(10000, 19999, 'story', 20.00),
(10000, 19999, 'post_reel', 40.00);

-- 20,000-29,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(20000, 29999, 'story', 30.00),
(20000, 29999, 'post_reel', 50.00);

-- 30,000-49,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(30000, 49999, 'story', 30.00),
(30000, 49999, 'post_reel', 50.00);

-- 50,000-69,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(50000, 69999, 'story', 40.00),
(50000, 69999, 'post_reel', 60.00);

-- 70,000-99,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(70000, 99999, 'story', 50.00),
(70000, 99999, 'post_reel', 70.00);

-- 100,000-199,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(100000, 199999, 'story', 60.00),
(100000, 199999, 'post_reel', 80.00);

-- 200,000-299,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(200000, 299999, 'story', 60.00),
(200000, 299999, 'post_reel', 80.00);

-- 300,000-499,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(300000, 499999, 'story', 70.00),
(300000, 499999, 'post_reel', 90.00);

-- 500,000-599,999 followers
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(500000, 599999, 'story', 80.00),
(500000, 599999, 'post_reel', 100.00);

-- 600,000+ followers (NULL max_followers = unlimited)
INSERT INTO cashback_tiers (min_followers, max_followers, content_type, cashback_percentage) VALUES
(600000, NULL, 'story', 80.00),
(600000, NULL, 'post_reel', 100.00);
