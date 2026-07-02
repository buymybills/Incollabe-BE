-- Create reel_categories + category_reels tables
-- Admin-curated occasion/style categories (Party Wear, Vacay Wear, Office Wear,
-- Casual Gathering, …), each grouping Instagram reels the shopping bot surfaces
-- as look-discovery chips. Tapping a category sends its reels; each reel can be
-- run through the bot's analyze → product-match pipeline.

CREATE TABLE IF NOT EXISTS reel_categories (
  id            SERIAL PRIMARY KEY,

  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) NOT NULL UNIQUE,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    INTEGER,

  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reel_categories_active ON reel_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_reel_categories_sort ON reel_categories(sort_order);

CREATE TABLE IF NOT EXISTS category_reels (
  id              SERIAL PRIMARY KEY,

  category_id     INTEGER NOT NULL REFERENCES reel_categories(id) ON DELETE CASCADE,
  reel_url        TEXT NOT NULL,
  media_shortcode VARCHAR(100),
  title           VARCHAR(255),
  caption         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      INTEGER,

  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category_reels_category ON category_reels(category_id);
CREATE INDEX IF NOT EXISTS idx_category_reels_active ON category_reels(is_active);
CREATE INDEX IF NOT EXISTS idx_category_reels_sort ON category_reels(sort_order);

COMMENT ON TABLE reel_categories IS 'Admin-curated look/occasion categories for the shopping bot';
COMMENT ON TABLE category_reels IS 'Instagram reels curated under a reel_category';
COMMENT ON COLUMN category_reels.reel_url IS 'Raw Instagram reel link pasted by the admin';
COMMENT ON COLUMN category_reels.media_shortcode IS 'Shortcode parsed from the link (e.g. Cabc123)';
