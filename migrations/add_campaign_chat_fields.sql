-- ============================================================
-- Migration: Campaign Chat Feature
-- Adds campaign-scoped conversation support and reviews table
-- ============================================================

-- 1. Add campaign fields to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_application_id INTEGER REFERENCES campaign_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_campaign_closed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaign_closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id ON conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type);

-- Unique: one campaign conversation per application
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_campaign_application
  ON conversations(campaign_application_id)
  WHERE campaign_application_id IS NOT NULL;

-- 2. Add COMPLETED status to campaign_applications
-- If using Postgres native ENUM type:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'enum_campaign_applications_status'
  ) THEN
    ALTER TYPE enum_campaign_applications_status ADD VALUE IF NOT EXISTS 'completed';
  ELSE
    -- If VARCHAR with check constraint, update the constraint
    ALTER TABLE campaign_applications
      DROP CONSTRAINT IF EXISTS campaign_applications_status_check;
    ALTER TABLE campaign_applications
      ADD CONSTRAINT campaign_applications_status_check
      CHECK (status IN ('applied','under_review','selected','rejected','withdrawn','completed'));
  END IF;
END$$;

-- 3. Create campaign_reviews table
CREATE TABLE IF NOT EXISTS campaign_reviews (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_application_id INTEGER NOT NULL REFERENCES campaign_applications(id) ON DELETE CASCADE,
  reviewer_type VARCHAR(20) NOT NULL,
  reviewer_id INTEGER NOT NULL,
  reviewee_type VARCHAR(20) NOT NULL,
  reviewee_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_application_id, reviewer_type, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_reviews_campaign_id ON campaign_reviews(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reviews_application_id ON campaign_reviews(campaign_application_id);
