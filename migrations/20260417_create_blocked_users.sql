-- Migration: Create blocked_users table
-- Date: 2026-04-17

CREATE TABLE IF NOT EXISTS blocked_users (
  id SERIAL PRIMARY KEY,
  blocker_type VARCHAR(20) NOT NULL CHECK (blocker_type IN ('influencer', 'brand')),
  blocker_influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
  blocker_brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  blocked_type VARCHAR(20) NOT NULL CHECK (blocked_type IN ('influencer', 'brand')),
  blocked_influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
  blocked_brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_block UNIQUE (
    blocker_type, blocker_influencer_id, blocker_brand_id,
    blocked_type, blocked_influencer_id, blocked_brand_id
  )
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_influencer
  ON blocked_users(blocker_type, blocker_influencer_id)
  WHERE blocker_influencer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_brand
  ON blocked_users(blocker_type, blocker_brand_id)
  WHERE blocker_brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_influencer
  ON blocked_users(blocked_type, blocked_influencer_id)
  WHERE blocked_influencer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_brand
  ON blocked_users(blocked_type, blocked_brand_id)
  WHERE blocked_brand_id IS NOT NULL;
