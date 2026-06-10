-- Migration: Add Hype Store Coupon-based Cashback Tracking System
-- Date: 2026-03-06
-- Description: Enables coupon code generation, creator preferences, cashback tiers, order tracking via webhooks

-- =====================================================
-- 1. Add external_website_url to existing hype_stores table
-- =====================================================
ALTER TABLE hype_stores
ADD COLUMN IF NOT EXISTS external_website_url VARCHAR(500);

COMMENT ON COLUMN hype_stores.external_website_url IS 'Brand website URL where influencers make purchases using coupon codes';

-- =====================================================
-- 2. Coupon Codes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_coupon_codes (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL REFERENCES hype_stores(id) ON DELETE CASCADE,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  coupon_code VARCHAR(50) NOT NULL UNIQUE,

  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  total_uses INTEGER DEFAULT 0 NOT NULL,
  max_uses INTEGER DEFAULT NULL,  -- NULL = unlimited uses

  -- Validity period
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deactivated_at TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_store_influencer_coupon UNIQUE (hype_store_id, influencer_id)
);

-- Indexes for coupon codes
CREATE INDEX idx_coupon_codes_store ON hype_store_coupon_codes(hype_store_id);
CREATE INDEX idx_coupon_codes_influencer ON hype_store_coupon_codes(influencer_id);
CREATE INDEX idx_coupon_codes_code ON hype_store_coupon_codes(coupon_code);
CREATE INDEX idx_coupon_codes_active ON hype_store_coupon_codes(is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE hype_store_coupon_codes IS 'Unique coupon codes generated for each influencer-store pair';
COMMENT ON COLUMN hype_store_coupon_codes.coupon_code IS 'Unique coupon code in format: {STORE_SLUG}-{INFLUENCER_ID}-{RANDOM}';
COMMENT ON COLUMN hype_store_coupon_codes.max_uses IS 'Maximum times this coupon can be used (NULL = unlimited)';

-- =====================================================
-- 3. Creator Preferences Table
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_creator_preferences (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL REFERENCES hype_stores(id) ON DELETE CASCADE,

  -- Influencer type filters (based on follower count)
  allowed_influencer_types TEXT[] DEFAULT NULL,  -- ['nano', 'micro', 'mid', 'macro', 'mega'] or NULL for all
  min_followers INTEGER DEFAULT 0 NOT NULL,
  max_followers INTEGER DEFAULT NULL,  -- NULL = no upper limit

  -- Niche/category filters
  allowed_niche_ids INTEGER[] DEFAULT NULL,  -- NULL = all niches allowed, [] = empty means no restriction

  -- Location filters
  allowed_city_ids INTEGER[] DEFAULT NULL,  -- NULL = all cities allowed
  allowed_states TEXT[] DEFAULT NULL,  -- NULL = all states allowed

  -- Engagement filters (future enhancement)
  min_engagement_rate DECIMAL(5, 2) DEFAULT NULL,  -- e.g., 2.50 = 2.5%

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- One preferences config per store
  CONSTRAINT unique_store_preferences UNIQUE (hype_store_id)
);

-- Indexes
CREATE INDEX idx_creator_prefs_store ON hype_store_creator_preferences(hype_store_id);

-- Comments
COMMENT ON TABLE hype_store_creator_preferences IS 'Defines which types of influencers can access each store based on follower count, niche, location';
COMMENT ON COLUMN hype_store_creator_preferences.allowed_influencer_types IS 'Array of influencer types: nano (1K-10K), micro (10K-50K), mid (50K-500K), macro (500K-1M), mega (1M+)';
COMMENT ON COLUMN hype_store_creator_preferences.min_engagement_rate IS 'Minimum engagement rate percentage (future use)';

-- =====================================================
-- 4. Cashback Tiers Table
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_cashback_tiers (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL REFERENCES hype_stores(id) ON DELETE CASCADE,

  -- Tier definition
  tier_name VARCHAR(50) NOT NULL,  -- e.g., 'Nano Influencers', 'Micro Influencers'
  min_followers INTEGER NOT NULL DEFAULT 0,
  max_followers INTEGER DEFAULT NULL,  -- NULL = no upper limit

  -- Cashback configuration (use either percentage OR fixed amount)
  cashback_type VARCHAR(20) NOT NULL CHECK (cashback_type IN ('percentage', 'fixed')),
  cashback_value DECIMAL(10, 2) NOT NULL CHECK (cashback_value >= 0),  -- 5.00 = 5% OR Rs 500

  -- Platform constraints
  min_cashback_amount DECIMAL(10, 2) DEFAULT 2000.00 NOT NULL,  -- Platform minimum: Rs 2000
  max_cashback_amount DECIMAL(10, 2) DEFAULT 12000.00 NOT NULL,  -- Brand-specific maximum

  -- Priority (higher priority = processed first if influencer matches multiple tiers)
  priority INTEGER DEFAULT 0 NOT NULL,

  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX idx_cashback_tiers_store ON hype_store_cashback_tiers(hype_store_id);
CREATE INDEX idx_cashback_tiers_followers ON hype_store_cashback_tiers(min_followers, max_followers);
CREATE INDEX idx_cashback_tiers_active ON hype_store_cashback_tiers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_cashback_tiers_priority ON hype_store_cashback_tiers(hype_store_id, priority DESC);

-- Comments
COMMENT ON TABLE hype_store_cashback_tiers IS 'Configurable cashback rates for different influencer tiers based on follower count';
COMMENT ON COLUMN hype_store_cashback_tiers.cashback_type IS 'Type: percentage (of order amount) or fixed (flat amount per order)';
COMMENT ON COLUMN hype_store_cashback_tiers.cashback_value IS 'Value depends on type: 5.00 for 5% or 500.00 for Rs 500';
COMMENT ON COLUMN hype_store_cashback_tiers.priority IS 'Higher priority tiers are matched first when influencer qualifies for multiple tiers';

-- =====================================================
-- 5. Orders Table
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_orders (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL REFERENCES hype_stores(id) ON DELETE CASCADE,
  coupon_code_id INTEGER NOT NULL REFERENCES hype_store_coupon_codes(id) ON DELETE RESTRICT,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE RESTRICT,

  -- Order details (from brand webhook)
  external_order_id VARCHAR(255) NOT NULL UNIQUE,  -- Brand's order ID (idempotency key)
  order_amount DECIMAL(10, 2) NOT NULL CHECK (order_amount > 0),
  order_currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
  order_date TIMESTAMP NOT NULL,

  -- Customer info (optional, from brand)
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_name VARCHAR(255),

  -- Order status tracking
  order_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    order_status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned')
  ),

  -- Cashback calculation
  cashback_amount DECIMAL(10, 2) NOT NULL CHECK (cashback_amount >= 0),
  cashback_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    cashback_status IN ('pending', 'processing', 'credited', 'failed', 'cancelled')
  ),
  cashback_tier_id INTEGER REFERENCES hype_store_cashback_tiers(id) ON DELETE SET NULL,

  -- Wallet transaction reference (once cashback is credited)
  wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,

  -- Webhook tracking
  webhook_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  webhook_signature VARCHAR(500),  -- HMAC signature for security verification
  webhook_ip_address INET,

  -- Processing metadata
  cashback_credited_at TIMESTAMP,
  processed_by INTEGER,  -- Admin ID if manually processed

  -- Additional metadata
  metadata JSONB,  -- Store additional order details from brand
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX idx_store_orders_store ON hype_store_orders(hype_store_id);
CREATE INDEX idx_store_orders_coupon ON hype_store_orders(coupon_code_id);
CREATE INDEX idx_store_orders_influencer ON hype_store_orders(influencer_id);
CREATE INDEX idx_store_orders_external_id ON hype_store_orders(external_order_id);
CREATE INDEX idx_store_orders_status ON hype_store_orders(order_status);
CREATE INDEX idx_store_orders_cashback_status ON hype_store_orders(cashback_status);
CREATE INDEX idx_store_orders_date ON hype_store_orders(order_date DESC);
CREATE INDEX idx_store_orders_pending_cashback ON hype_store_orders(cashback_status)
  WHERE cashback_status IN ('pending', 'processing');

-- Comments
COMMENT ON TABLE hype_store_orders IS 'Orders placed by influencers using coupon codes, received via webhook from brand website';
COMMENT ON COLUMN hype_store_orders.external_order_id IS 'Brand order ID - used as idempotency key to prevent duplicate processing';
COMMENT ON COLUMN hype_store_orders.cashback_amount IS 'Calculated cashback amount based on tier and order value';
COMMENT ON COLUMN hype_store_orders.metadata IS 'Additional order data from brand (items, shipping address, etc.)';

-- =====================================================
-- 6. Webhook Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_webhook_logs (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER REFERENCES hype_stores(id) ON DELETE SET NULL,

  -- Request details
  request_method VARCHAR(10) NOT NULL,
  request_path TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  request_ip INET,

  -- Response details
  response_status INTEGER,
  response_body JSONB,

  -- Processing
  is_valid BOOLEAN DEFAULT FALSE NOT NULL,
  error_message TEXT,
  processed_order_id INTEGER REFERENCES hype_store_orders(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX idx_webhook_logs_store ON hype_store_webhook_logs(hype_store_id);
CREATE INDEX idx_webhook_logs_created ON hype_store_webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_valid ON hype_store_webhook_logs(is_valid);

-- Comments
COMMENT ON TABLE hype_store_webhook_logs IS 'Audit trail for all incoming webhook requests (debugging and security monitoring)';
COMMENT ON COLUMN hype_store_webhook_logs.is_valid IS 'Whether signature verification and processing succeeded';

-- =====================================================
-- 7. Webhook Secrets Table
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_webhook_secrets (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL UNIQUE REFERENCES hype_stores(id) ON DELETE CASCADE,

  -- Webhook security
  webhook_secret VARCHAR(255) NOT NULL,  -- HMAC secret for signature verification
  webhook_url TEXT,  -- Optional: webhook endpoint on brand's side for notifications

  -- API keys for brand integration
  api_key VARCHAR(255) UNIQUE NOT NULL,  -- Generated API key for brand (URL path identifier)
  api_key_hash VARCHAR(255),  -- Hashed version for secure lookup (future use)

  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_used_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX idx_webhook_secrets_store ON hype_store_webhook_secrets(hype_store_id);
CREATE INDEX idx_webhook_secrets_api_key ON hype_store_webhook_secrets(api_key);

-- Comments
COMMENT ON TABLE hype_store_webhook_secrets IS 'Authentication credentials for webhook integration (one per store)';
COMMENT ON COLUMN hype_store_webhook_secrets.webhook_secret IS 'Secret key used to generate HMAC-SHA256 signatures for webhook requests';
COMMENT ON COLUMN hype_store_webhook_secrets.api_key IS 'Unique API key identifying the store in webhook URL';

-- =====================================================
-- 8. Update Functions (for updated_at timestamps)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all new tables
CREATE TRIGGER update_hype_store_coupon_codes_updated_at BEFORE UPDATE ON hype_store_coupon_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hype_store_creator_preferences_updated_at BEFORE UPDATE ON hype_store_creator_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hype_store_cashback_tiers_updated_at BEFORE UPDATE ON hype_store_cashback_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hype_store_orders_updated_at BEFORE UPDATE ON hype_store_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hype_store_webhook_secrets_updated_at BEFORE UPDATE ON hype_store_webhook_secrets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- - Added external_website_url to hype_stores
-- - Created 6 new tables: coupon_codes, creator_preferences, cashback_tiers, orders, webhook_logs, webhook_secrets
-- - Created 26 indexes for optimal query performance
-- - Added 5 triggers for automatic updated_at timestamp management
-- - All tables have proper foreign key constraints and referential integrity
