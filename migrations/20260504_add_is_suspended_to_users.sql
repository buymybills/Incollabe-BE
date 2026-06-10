-- Add is_suspended column to influencers and brands tables
-- Distinguishes report-based suspension from user self-deactivation

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
