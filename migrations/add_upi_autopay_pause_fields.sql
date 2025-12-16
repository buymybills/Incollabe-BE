-- Migration: Add UPI Autopay and Pause/Resume functionality to pro_subscriptions
-- Date: 2025-12-09
-- Description: Adds fields for UPI mandate, pause/resume tracking, and autopay management

-- Add UPI autopay and mandate fields
ALTER TABLE pro_subscriptions
ADD COLUMN IF NOT EXISTS upi_mandate_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS upi_mandate_status VARCHAR(50) DEFAULT 'not_created',
ADD COLUMN IF NOT EXISTS mandate_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS mandate_authenticated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS mandate_max_amount INTEGER DEFAULT 19900,

-- Add pause/resume fields
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS pause_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS resume_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS pause_reason TEXT,

-- Add tracking fields
ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paused_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_auto_charge_attempt TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_charge_failures INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN pro_subscriptions.upi_mandate_id IS 'Razorpay UPI mandate/token ID for autopay';
COMMENT ON COLUMN pro_subscriptions.upi_mandate_status IS 'Status: not_created, pending, authenticated, paused, cancelled, rejected';
COMMENT ON COLUMN pro_subscriptions.mandate_created_at IS 'When UPI mandate was created';
COMMENT ON COLUMN pro_subscriptions.mandate_authenticated_at IS 'When user approved UPI mandate in their UPI app';
COMMENT ON COLUMN pro_subscriptions.mandate_max_amount IS 'Maximum amount that can be charged via autopay (in paise)';
COMMENT ON COLUMN pro_subscriptions.is_paused IS 'Whether subscription is currently paused';
COMMENT ON COLUMN pro_subscriptions.paused_at IS 'When subscription was paused (after current cycle ends)';
COMMENT ON COLUMN pro_subscriptions.pause_duration_days IS 'Number of days to pause subscription';
COMMENT ON COLUMN pro_subscriptions.resume_date IS 'Calculated date when subscription should auto-resume';
COMMENT ON COLUMN pro_subscriptions.pause_reason IS 'User-provided reason for pausing';
COMMENT ON COLUMN pro_subscriptions.pause_count IS 'Number of times subscription has been paused';
COMMENT ON COLUMN pro_subscriptions.total_paused_days IS 'Total accumulated paused days';
COMMENT ON COLUMN pro_subscriptions.last_auto_charge_attempt IS 'Last time auto-charge was attempted';
COMMENT ON COLUMN pro_subscriptions.auto_charge_failures IS 'Number of consecutive auto-charge failures';

-- Create index for efficient querying of paused subscriptions ready to resume
CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_resume_date
ON pro_subscriptions(resume_date)
WHERE is_paused = TRUE AND resume_date IS NOT NULL;

-- Create index for autopay subscriptions
CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_autopay
ON pro_subscriptions("nextBillingDate", "autoRenew")
WHERE status = 'active' AND "autoRenew" = TRUE;

-- Create index for UPI mandate lookups
CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_upi_mandate
ON pro_subscriptions(upi_mandate_id)
WHERE upi_mandate_id IS NOT NULL;
