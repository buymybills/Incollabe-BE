-- A shopper's cart, built from the Instagram bot ("🛒 Add to cart") and reviewed
-- before checkout. Keyed by igsid. One row per (igsid, product, size).

CREATE TABLE IF NOT EXISTS bot_cart_items (
  id          SERIAL PRIMARY KEY,
  igsid       VARCHAR(64)   NOT NULL,
  product_url VARCHAR(1024) NOT NULL,
  title       VARCHAR(255)  NOT NULL,
  size        VARCHAR(20),
  price_inr   NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url   VARCHAR(1024),
  slug        VARCHAR(255),
  qty         INTEGER       NOT NULL DEFAULT 1,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_cart_items_igsid ON bot_cart_items(igsid);
-- size may be NULL, so COALESCE to a sentinel for the uniqueness key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_cart_items_line
  ON bot_cart_items(igsid, product_url, COALESCE(size, ''));
