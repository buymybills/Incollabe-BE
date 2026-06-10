-- Add content_type column to hype_store_orders table
-- This column determines which cashback tier to use (story vs post/reel)

ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'post_reel' CHECK (content_type IN ('story', 'post_reel'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_content_type ON hype_store_orders(content_type);

-- Add comment
COMMENT ON COLUMN hype_store_orders.content_type IS 'Content type for cashback calculation: story or post_reel. Determines which cashback percentage tier to apply.';
