-- Migration: Create top_influencer_score_cache table
-- Purpose: Store pre-computed top influencer scores calculated daily by cron job
-- This avoids re-calculating expensive scores on every API request

CREATE TABLE IF NOT EXISTS top_influencer_score_cache (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  overall_score DECIMAL(10, 5) NOT NULL DEFAULT 0,
  score_breakdown JSONB,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_top_influencer_score_cache_influencer UNIQUE (influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_top_influencer_cache_score
  ON top_influencer_score_cache(overall_score DESC);

CREATE INDEX IF NOT EXISTS idx_top_influencer_cache_influencer_id
  ON top_influencer_score_cache(influencer_id);

CREATE INDEX IF NOT EXISTS idx_top_influencer_cache_calculated_at
  ON top_influencer_score_cache(calculated_at DESC);
