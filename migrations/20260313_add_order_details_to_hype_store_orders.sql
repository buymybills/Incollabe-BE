-- Migration: Add order details fields to hype_store_orders table
-- Date: 2026-03-13
-- Description: Add orderTitle, cashbackType, and proofViewCount fields for better order tracking

-- Add orderTitle field to store product name
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS order_title VARCHAR(500) NULL;

-- Add cashbackType field to store cashback description (e.g., "Flat 20%", "₹500 off")
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS cashback_type VARCHAR(100) NULL;

-- Add proofViewCount field to store Instagram reel/story view count
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS proof_view_count INTEGER NULL;

-- Add proofPostedAt field to track when the content was posted on Instagram
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS proof_posted_at TIMESTAMP NULL;

-- Add proofThumbnailUrl field to store the thumbnail image
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS proof_thumbnail_url VARCHAR(500) NULL;

-- Add comments to describe each column
COMMENT ON COLUMN hype_store_orders.order_title IS 'Product/order title sent by brand in webhook metadata';
COMMENT ON COLUMN hype_store_orders.cashback_type IS 'Cashback type description for UI display';
COMMENT ON COLUMN hype_store_orders.proof_view_count IS 'Instagram media view count fetched from Instagram API';
COMMENT ON COLUMN hype_store_orders.proof_posted_at IS 'Timestamp when content was posted on Instagram';
COMMENT ON COLUMN hype_store_orders.proof_thumbnail_url IS 'Thumbnail image URL for the promotion media';
