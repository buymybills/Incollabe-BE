-- Migration: Add ROI, Engagement, and Reach metrics to hype_store_orders
-- Date: 2026-03-12
-- Description: Add fields to track expected ROI, estimated engagement, and estimated reach for orders

-- Add columns to hype_store_orders table
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS expected_roi DECIMAL(5, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_engagement INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_reach INTEGER DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN hype_store_orders.expected_roi IS 'Expected ROI percentage for this order';
COMMENT ON COLUMN hype_store_orders.estimated_engagement IS 'Estimated engagement count';
COMMENT ON COLUMN hype_store_orders.estimated_reach IS 'Estimated reach count';

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_roi ON hype_store_orders(expected_roi);
CREATE INDEX IF NOT EXISTS idx_orders_engagement ON hype_store_orders(estimated_engagement);
CREATE INDEX IF NOT EXISTS idx_orders_reach ON hype_store_orders(estimated_reach);
