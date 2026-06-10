-- Migration: Add ABANDONED status to subscription status enum
-- Description: Adds 'abandoned' as a valid subscription status for drop-off tracking

-- Add 'abandoned' to the subscription_status enum type
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'abandoned';

-- Comment for documentation
COMMENT ON TYPE subscription_status IS 'Subscription status: active, paused, expired, cancelled, payment_pending, payment_failed, abandoned, inactive';
