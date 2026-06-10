-- Add missing return tracking fields to hype_store_orders
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS is_returned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS return_period_days INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS return_period_ends_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS minimum_cashback_claimed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS expected_roi DECIMAL(5,2) NULL,
ADD COLUMN IF NOT EXISTS estimated_engagement INTEGER NULL,
ADD COLUMN IF NOT EXISTS estimated_reach INTEGER NULL;
