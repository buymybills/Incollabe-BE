-- Migration: Add Subscription Marketing Fields (FIXED for camelCase columns)
-- Description: Adds fields for drop-off tracking, nudges, and promotions

-- Step 1: Create pro_subscription_promotions table first (so we can reference it)
CREATE TABLE IF NOT EXISTS pro_subscription_promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  original_price INTEGER NOT NULL DEFAULT 19900, -- ₹199 in paise
  discounted_price INTEGER NOT NULL, -- e.g., 14900 for ₹149
  discount_percentage INTEGER, -- e.g., 25 for 25% off
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER, -- Optional: limit to first X subscribers (null = unlimited)
  current_uses INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add reminder tracking and promotion reference to pro_subscriptions table
ALTER TABLE pro_subscriptions
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promotion_id INTEGER REFERENCES pro_subscription_promotions(id) ON DELETE SET NULL;

-- Step 3: Add last nudge tracking to influencers table
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMP WITH TIME ZONE;

-- Step 4: Create indexes for performance optimization (FIXED - use camelCase column names)
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates
ON pro_subscription_promotions(is_active, start_date, end_date)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_reminder_sent
ON pro_subscriptions(reminder_sent_at, status, "createdAt")
WHERE status = 'payment_pending';

CREATE INDEX IF NOT EXISTS idx_influencers_last_nudge_sent
ON influencers(last_nudge_sent_at, "isPro", "isVerified")
WHERE "isPro" = false AND "isVerified" = true;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN pro_subscriptions.reminder_sent_at IS 'Timestamp when payment reminder notification was sent (for drop-off tracking)';
COMMENT ON COLUMN pro_subscriptions.promotion_id IS 'Reference to promotional offer used (if any)';
COMMENT ON COLUMN influencers.last_nudge_sent_at IS 'Timestamp when last subscription marketing nudge was sent';
COMMENT ON TABLE pro_subscription_promotions IS 'Flash sales and promotional offers for Pro subscriptions';
COMMENT ON COLUMN pro_subscription_promotions.max_uses IS 'Maximum number of subscriptions allowed with this promotion (NULL = unlimited)';
COMMENT ON COLUMN pro_subscription_promotions.current_uses IS 'Number of subscriptions that have used this promotion';
COMMENT ON COLUMN pro_subscription_promotions.discount_percentage IS 'Discount percentage for display purposes (calculated: (original - discounted) / original * 100)';
