-- Migration: Add proof submission fields to hype_store_orders table
-- Date: 2026-03-10
-- Description: Adds fields for Instagram proof submission and minimum cashback claiming

-- Add new columns for proof submission
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS instagram_proof_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS proof_content_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS minimum_cashback_claimed BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN hype_store_orders.instagram_proof_url IS 'URL of Instagram Reel/Post/Story submitted as proof';
COMMENT ON COLUMN hype_store_orders.proof_content_type IS 'Type of content: reel, post, or story';
COMMENT ON COLUMN hype_store_orders.proof_submitted_at IS 'Timestamp when proof was submitted';
COMMENT ON COLUMN hype_store_orders.minimum_cashback_claimed IS 'Whether influencer claimed minimum cashback without posting';

-- Create index for faster queries on proof submission status
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_proof_submitted
ON hype_store_orders(proof_submitted_at)
WHERE proof_submitted_at IS NOT NULL;

-- Create index for minimum cashback claims
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_minimum_cashback
ON hype_store_orders(minimum_cashback_claimed)
WHERE minimum_cashback_claimed = true;
