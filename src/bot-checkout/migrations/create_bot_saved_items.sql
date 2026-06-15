-- Products saved by shoppers from the Instagram bot ("💾 Save"), persisted in
-- the backend (replacing the bot's in-memory Map). Keyed by igsid.

CREATE TABLE IF NOT EXISTS bot_saved_items (
  id          SERIAL PRIMARY KEY,
  igsid       VARCHAR(64)  NOT NULL,
  product_url VARCHAR(1024) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  image_url   VARCHAR(1024),
  slug        VARCHAR(255),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_saved_items_igsid ON bot_saved_items(igsid);
-- One row per (shopper, product); uniqueness is also enforced in the service.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_saved_items_igsid_url ON bot_saved_items(igsid, product_url);
