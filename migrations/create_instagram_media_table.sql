-- Create instagram_media table to store Instagram posts/media
-- This table stores the actual post data (caption, images, etc.)

CREATE TABLE IF NOT EXISTS instagram_media (
    id SERIAL PRIMARY KEY,

    -- Foreign keys
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,

    -- Instagram media information
    media_id VARCHAR(255) NOT NULL UNIQUE,
    caption TEXT,
    media_type VARCHAR(50), -- IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
    media_product_type VARCHAR(50), -- FEED, REELS, STORY
    media_url TEXT,
    thumbnail_url TEXT,
    permalink TEXT,
    timestamp TIMESTAMP, -- When the post was published on Instagram

    -- Metadata
    first_fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_media_user_type CHECK (
        (influencer_id IS NOT NULL AND brand_id IS NULL) OR
        (influencer_id IS NULL AND brand_id IS NOT NULL)
    )
);

-- Indexes for better query performance
CREATE INDEX idx_instagram_media_influencer ON instagram_media(influencer_id);
CREATE INDEX idx_instagram_media_brand ON instagram_media(brand_id);
CREATE INDEX idx_instagram_media_media_id ON instagram_media(media_id);
CREATE INDEX idx_instagram_media_timestamp ON instagram_media(timestamp);

-- Add comments
COMMENT ON TABLE instagram_media IS 'Stores Instagram posts/media data';
COMMENT ON COLUMN instagram_media.media_id IS 'Instagram media ID (unique)';
COMMENT ON COLUMN instagram_media.timestamp IS 'When the post was published on Instagram';
COMMENT ON COLUMN instagram_media.first_fetched_at IS 'When we first fetched this post from Instagram';
COMMENT ON COLUMN instagram_media.last_synced_at IS 'Last time we synced this post data from Instagram';
