-- Create instagram_media_insights table to store Instagram media insights data
-- This table stores historical insights data for Instagram posts

CREATE TABLE IF NOT EXISTS instagram_media_insights (
    id SERIAL PRIMARY KEY,

    -- Foreign keys
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
    instagram_media_id INTEGER REFERENCES instagram_media(id) ON DELETE CASCADE,

    -- Media information (denormalized for faster queries)
    media_id VARCHAR(255) NOT NULL,
    media_type VARCHAR(50), -- IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
    media_product_type VARCHAR(50), -- FEED, REELS, STORY

    -- Insights metrics
    reach INTEGER,
    saved INTEGER,
    likes INTEGER,
    comments INTEGER,
    plays INTEGER, -- for videos/reels
    shares INTEGER, -- for reels
    total_interactions INTEGER, -- for reels

    -- Metadata
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_user_type CHECK (
        (influencer_id IS NOT NULL AND brand_id IS NULL) OR
        (influencer_id IS NULL AND brand_id IS NOT NULL)
    )
);

-- Indexes for better query performance
CREATE INDEX idx_instagram_media_insights_influencer ON instagram_media_insights(influencer_id);
CREATE INDEX idx_instagram_media_insights_brand ON instagram_media_insights(brand_id);
CREATE INDEX idx_instagram_media_insights_media_id ON instagram_media_insights(media_id);
CREATE INDEX idx_instagram_media_insights_instagram_media_id ON instagram_media_insights(instagram_media_id);
CREATE INDEX idx_instagram_media_insights_fetched_at ON instagram_media_insights(fetched_at);

-- Unique index: one record per media per day per user (for influencers)
CREATE UNIQUE INDEX idx_unique_media_insights_per_day_influencer
ON instagram_media_insights (media_id, influencer_id, DATE(fetched_at))
WHERE influencer_id IS NOT NULL;

-- Unique index: one record per media per day per user (for brands)
CREATE UNIQUE INDEX idx_unique_media_insights_per_day_brand
ON instagram_media_insights (media_id, brand_id, DATE(fetched_at))
WHERE brand_id IS NOT NULL;

-- Add comments
COMMENT ON TABLE instagram_media_insights IS 'Stores historical Instagram media insights data';
COMMENT ON COLUMN instagram_media_insights.media_id IS 'Instagram media ID';
COMMENT ON COLUMN instagram_media_insights.fetched_at IS 'When the insights were fetched from Instagram API';
