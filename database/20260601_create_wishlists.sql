-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create wishlists + wishlist_items tables
-- Purpose  : Instagram DM wishlist folders — save, view, and share products
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlists (
  id            SERIAL        PRIMARY KEY,
  ig_sender_id  VARCHAR(64)   NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  share_token   UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- One folder name per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_name
  ON wishlists(ig_sender_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_wishlists_ig_sender
  ON wishlists(ig_sender_id);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id            SERIAL          PRIMARY KEY,
  wishlist_id   INTEGER         NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_name  VARCHAR(256)    NOT NULL,
  brand_name    VARCHAR(128)    NOT NULL,
  product_url   TEXT,
  image_url     TEXT,
  price_inr     NUMERIC(10, 2),
  size          VARCHAR(32),
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist_id
  ON wishlist_items(wishlist_id);
