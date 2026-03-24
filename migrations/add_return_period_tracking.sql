-- Migration: Add return period tracking to hype_store_orders
-- Date: 2026-03-10
-- Description: Adds fields to track 30-day return period and order visibility to influencers

-- Add new columns for return period management
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS return_period_days INTEGER DEFAULT 30 NOT NULL,
ADD COLUMN IF NOT EXISTS return_period_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS visible_to_influencer BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS visibility_checked_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN hype_store_orders.return_period_days IS 'Number of days for return period (default: 30 days)';
COMMENT ON COLUMN hype_store_orders.return_period_ends_at IS 'Date when return period ends (order_date + return_period_days)';
COMMENT ON COLUMN hype_store_orders.visible_to_influencer IS 'Whether order is visible to influencer (true after return period ends)';
COMMENT ON COLUMN hype_store_orders.visibility_checked_at IS 'Last time we checked if order should be visible';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_visibility
ON hype_store_orders(visible_to_influencer, return_period_ends_at)
WHERE visible_to_influencer = false;

CREATE INDEX IF NOT EXISTS idx_hype_store_orders_pending_visibility
ON hype_store_orders(return_period_ends_at)
WHERE visible_to_influencer = false AND order_status NOT IN ('returned', 'refunded', 'cancelled');

-- Update existing orders to set return_period_ends_at
UPDATE hype_store_orders
SET return_period_ends_at = order_date + INTERVAL '30 days',
    visible_to_influencer = CASE
        WHEN order_date + INTERVAL '30 days' <= NOW() AND order_status NOT IN ('returned', 'refunded', 'cancelled')
        THEN true
        ELSE false
    END
WHERE return_period_ends_at IS NULL;

-- Create function to automatically set return_period_ends_at on insert
CREATE OR REPLACE FUNCTION set_return_period_ends_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_period_ends_at IS NULL THEN
        NEW.return_period_ends_at := NEW.order_date + (NEW.return_period_days || ' days')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call function on insert
DROP TRIGGER IF EXISTS trigger_set_return_period_ends_at ON hype_store_orders;
CREATE TRIGGER trigger_set_return_period_ends_at
    BEFORE INSERT ON hype_store_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_return_period_ends_at();
