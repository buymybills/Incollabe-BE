-- Migration: Add content_type column to hype_store_orders table
-- Purpose: Track whether order was from REEL or STORY content for accurate cashback calculation
-- Date: 2026-03-19

-- Add content_type column to hype_store_orders table
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'REEL';

-- Add comment to explain the column
COMMENT ON COLUMN hype_store_orders.content_type IS 'Content type for cashback calculation: REEL (permanent posts/reels with higher %), STORY (24-hour stories with lower %), or NO_CONTENT (no proof submitted, 7% flat). Defaults to REEL.';

-- Create index for efficient querying by content type
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_content_type
ON hype_store_orders(hype_store_id, content_type, order_status);

-- Add check constraint to ensure valid content types
ALTER TABLE hype_store_orders
ADD CONSTRAINT IF NOT EXISTS chk_order_content_type
CHECK (content_type IN ('REEL', 'STORY', 'NO_CONTENT'));
