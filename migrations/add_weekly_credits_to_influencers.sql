-- Migration: Add weekly credits system for influencers
-- Description: Every influencer gets 5 credits per week, deducted on campaign application
-- Reset date: Every Monday at 00:00

-- Add weeklyCredits column (default: 5)
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS weekly_credits INTEGER DEFAULT 5;

-- Add weeklyCreditsResetDate column
-- Default: Next Monday from current date
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS weekly_credits_reset_date TIMESTAMP WITH TIME ZONE;

-- Update existing influencers with initial values
UPDATE influencers
SET
  weekly_credits = 5,
  weekly_credits_reset_date = date_trunc('week', NOW() + INTERVAL '1 week')
WHERE weekly_credits IS NULL OR weekly_credits_reset_date IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN influencers.weekly_credits IS 'Current remaining credits for the week (max 5, resets every Monday)';
COMMENT ON COLUMN influencers.weekly_credits_reset_date IS 'Date when credits will reset to 5 (every Monday at 00:00)';
