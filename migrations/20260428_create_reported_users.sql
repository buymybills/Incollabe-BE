-- Create reported_users table
CREATE TABLE IF NOT EXISTS reported_users (
  id SERIAL PRIMARY KEY,
  reporter_type VARCHAR(20) NOT NULL CHECK (reporter_type IN ('influencer', 'brand')),
  reporter_influencer_id INTEGER REFERENCES influencers(id) ON DELETE SET NULL,
  reporter_brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  reported_type VARCHAR(20) NOT NULL CHECK (reported_type IN ('influencer', 'brand')),
  reported_influencer_id INTEGER REFERENCES influencers(id) ON DELETE SET NULL,
  reported_brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'spam',
    'harassment',
    'fake_account',
    'inappropriate_content',
    'scam',
    'hate_speech',
    'other'
  )),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Prevent the same user from reporting the same target more than once
  UNIQUE (reporter_type, reporter_influencer_id, reporter_brand_id, reported_type, reported_influencer_id, reported_brand_id)
);

CREATE INDEX IF NOT EXISTS idx_reported_users_reporter_influencer ON reported_users(reporter_influencer_id);
CREATE INDEX IF NOT EXISTS idx_reported_users_reporter_brand ON reported_users(reporter_brand_id);
CREATE INDEX IF NOT EXISTS idx_reported_users_reported_influencer ON reported_users(reported_influencer_id);
CREATE INDEX IF NOT EXISTS idx_reported_users_reported_brand ON reported_users(reported_brand_id);
