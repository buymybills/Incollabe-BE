-- Migration: Create hype_store_referral_clicks table
-- Description: Tracks individual click events on referral links for analytics and conversion tracking

-- Create the table
CREATE TABLE IF NOT EXISTS hype_store_referral_clicks (
  id SERIAL PRIMARY KEY,
  referral_code_id INTEGER NOT NULL,
  hype_store_id INTEGER NOT NULL,
  influencer_id INTEGER NOT NULL,
  session_id VARCHAR(100),
  customer_ip VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  converted BOOLEAN NOT NULL DEFAULT false,
  order_id INTEGER,
  converted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_click_referral_code
    FOREIGN KEY (referral_code_id)
    REFERENCES hype_store_referral_codes(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_click_hype_store
    FOREIGN KEY (hype_store_id)
    REFERENCES hype_stores(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_click_influencer
    FOREIGN KEY (influencer_id)
    REFERENCES influencers(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_click_order
    FOREIGN KEY (order_id)
    REFERENCES hype_store_orders(id)
    ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referral_code_id ON hype_store_referral_clicks(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_hype_store_id ON hype_store_referral_clicks(hype_store_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_influencer_id ON hype_store_referral_clicks(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON hype_store_referral_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_converted ON hype_store_referral_clicks(converted);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_session_id ON hype_store_referral_clicks(session_id);

-- Add comment to table
COMMENT ON TABLE hype_store_referral_clicks IS 'Tracks individual click events on referral links for analytics and conversion tracking.';

COMMENT ON COLUMN hype_store_referral_clicks.session_id IS 'Session ID from brand website (if provided)';
COMMENT ON COLUMN hype_store_referral_clicks.customer_ip IS 'IP address of the customer who clicked';
COMMENT ON COLUMN hype_store_referral_clicks.user_agent IS 'User agent string from the click';
COMMENT ON COLUMN hype_store_referral_clicks.referrer IS 'Referring URL (where the customer came from)';
COMMENT ON COLUMN hype_store_referral_clicks.clicked_at IS 'When the click occurred';
COMMENT ON COLUMN hype_store_referral_clicks.converted IS 'Whether this click led to a conversion (order)';
COMMENT ON COLUMN hype_store_referral_clicks.order_id IS 'Order ID if this click converted';
COMMENT ON COLUMN hype_store_referral_clicks.converted_at IS 'When the conversion happened';
