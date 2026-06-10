-- Add Smart Nudge Tracking Fields
-- Enables smart frequency control and message rotation

-- Add tracking fields to influencers table
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS first_nudge_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS nudge_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_nudge_message_index INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN influencers.first_nudge_sent_at IS 'Timestamp when the first subscription nudge was sent to this influencer';
COMMENT ON COLUMN influencers.nudge_count IS 'Total number of subscription nudges sent to this influencer';
COMMENT ON COLUMN influencers.last_nudge_message_index IS 'Index of the last message sent (0-4) for rotation';

-- Initialize existing data
-- Set nudge_count = 1 for users who have received at least one nudge
UPDATE influencers
SET
  nudge_count = 1,
  first_nudge_sent_at = last_nudge_sent_at
WHERE last_nudge_sent_at IS NOT NULL;
