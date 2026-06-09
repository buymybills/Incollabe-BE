-- Migration: Instagram shopping-bot analytics event store
-- Backs the bot-analytics ingestion + admin dashboard (multi-tenant via `brand`).
-- Model: src/bot-analytics/models/bot-event.model.ts (underscored columns).

CREATE TABLE IF NOT EXISTS bot_events (
  id            SERIAL PRIMARY KEY,
  brand         VARCHAR(60)  NOT NULL DEFAULT 'thesouledstore',
  source        VARCHAR(20)  NOT NULL DEFAULT 'instagram',
  user_key      VARCHAR(64),
  session_id    VARCHAR(100),
  event_type    VARCHAR(40)  NOT NULL,
  product_slug  VARCHAR(180),
  product_title VARCHAR(200),
  category      VARCHAR(120),
  gender        VARCHAR(20),
  size          VARCHAR(20),
  price_inr     DOUBLE PRECISION,
  value_inr     DOUBLE PRECISION,
  query         VARCHAR(300),
  faq_category  VARCHAR(60),
  answered      BOOLEAN,
  metadata      JSONB,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for the dashboard aggregation queries
CREATE INDEX IF NOT EXISTS idx_bot_events_brand_type_created
  ON bot_events (brand, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_events_brand_slug
  ON bot_events (brand, product_slug);
CREATE INDEX IF NOT EXISTS idx_bot_events_user_key
  ON bot_events (user_key);
CREATE INDEX IF NOT EXISTS idx_bot_events_created_at
  ON bot_events (created_at);

COMMENT ON TABLE bot_events IS 'Instagram shopping-bot funnel/engagement/CS events (per brand).';
