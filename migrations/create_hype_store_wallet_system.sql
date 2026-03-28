-- Migration: Create Hype Store Wallet System
-- Date: 2026-03-05
-- Description: Creates wallets, wallet transactions, and hype stores tables for brand-influencer payment system

-- =====================================================
-- 1. WALLETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('influencer', 'brand')),
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  total_credited DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_debited DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_cashback_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_redeemed DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one wallet per user
  CONSTRAINT unique_user_wallet UNIQUE (user_id, user_type)
);

-- Indexes for wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_wallets_active ON wallets(is_active);

-- =====================================================
-- 2. WALLET TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  transaction_type VARCHAR(30) NOT NULL CHECK (
    transaction_type IN (
      'recharge',           -- Brand adds money to wallet
      'debit',              -- Brand pays influencer
      'cashback',           -- Influencer receives cashback
      'redemption',         -- Influencer withdraws money
      'refund',             -- Money returned to wallet
      'adjustment'          -- Admin adjustment
    )
  ),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),

  -- Payment gateway details (for recharge/redemption)
  payment_gateway VARCHAR(20),
  payment_order_id VARCHAR(255),
  payment_transaction_id VARCHAR(255),
  payment_reference_id VARCHAR(255),

  -- UPI details (for redemptions)
  upi_id VARCHAR(255),

  -- Related entities
  related_user_id INTEGER,           -- For debits: recipient influencer ID
  related_user_type VARCHAR(20),     -- For debits: 'influencer'
  campaign_id INTEGER,               -- If payment is for a campaign
  hype_store_id INTEGER,             -- If transaction is from hype store

  -- Metadata
  description TEXT,
  notes TEXT,
  metadata JSONB,                    -- Additional data (e.g., razorpay response)

  -- Processing details
  processed_by INTEGER,              -- Admin who processed (for redemptions)
  processed_at TIMESTAMP,
  failed_reason TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for wallet_transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_order ON wallet_transactions(payment_order_id) WHERE payment_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_related_user ON wallet_transactions(related_user_id, related_user_type) WHERE related_user_id IS NOT NULL;

-- =====================================================
-- 3. HYPE STORES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_stores (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL UNIQUE,
  store_name VARCHAR(255) NOT NULL,
  store_slug VARCHAR(255) UNIQUE,
  store_description TEXT,
  store_logo VARCHAR(500),
  store_banner VARCHAR(500),

  -- Store settings
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  min_order_value DECIMAL(10, 2) DEFAULT 0.00,
  max_order_value DECIMAL(10, 2),

  -- Statistics
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0.00,
  total_cashback_given DECIMAL(12, 2) DEFAULT 0.00,

  -- Metadata
  settings JSONB,                    -- Store-specific settings

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_hype_stores_brand FOREIGN KEY (brand_id)
    REFERENCES brands(id) ON DELETE CASCADE
);

-- Indexes for hype_stores
CREATE INDEX IF NOT EXISTS idx_hype_stores_brand ON hype_stores(brand_id);
CREATE INDEX IF NOT EXISTS idx_hype_stores_slug ON hype_stores(store_slug);
CREATE INDEX IF NOT EXISTS idx_hype_stores_active ON hype_stores(is_active);

-- =====================================================
-- 4. RECHARGE LIMITS TABLE (for brand wallet recharges)
-- =====================================================
CREATE TABLE IF NOT EXISTS wallet_recharge_limits (
  id SERIAL PRIMARY KEY,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('brand', 'influencer')),
  min_recharge_amount DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  max_recharge_amount DECIMAL(10, 2) NOT NULL DEFAULT 5000.00,
  daily_recharge_limit DECIMAL(10, 2),
  monthly_recharge_limit DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_recharge_limit_user_type UNIQUE (user_type)
);

-- Insert default recharge limits
INSERT INTO wallet_recharge_limits (user_type, min_recharge_amount, max_recharge_amount)
VALUES
  ('brand', 5000.00, NULL),              -- Minimum ₹5,000, No maximum limit
  ('influencer', 0.00, NULL)              -- Influencers can't add money, only receive
ON CONFLICT (user_type) DO NOTHING;

-- =====================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE wallets IS 'Stores wallet balances for brands and influencers';
COMMENT ON COLUMN wallets.user_id IS 'Foreign key to brands.id or influencers.id depending on user_type';
COMMENT ON COLUMN wallets.user_type IS 'Type of user: brand or influencer';
COMMENT ON COLUMN wallets.balance IS 'Current wallet balance in Rs';
COMMENT ON COLUMN wallets.total_credited IS 'Total amount added to wallet (recharges + refunds)';
COMMENT ON COLUMN wallets.total_debited IS 'Total amount spent from wallet (payments)';
COMMENT ON COLUMN wallets.total_cashback_received IS 'Total cashback received (influencers only)';
COMMENT ON COLUMN wallets.total_redeemed IS 'Total amount withdrawn (influencers only)';

COMMENT ON TABLE wallet_transactions IS 'Tracks all wallet operations including recharges, payments, cashback, and redemptions';
COMMENT ON COLUMN wallet_transactions.transaction_type IS 'Type: recharge, debit, cashback, redemption, refund, adjustment';
COMMENT ON COLUMN wallet_transactions.status IS 'Transaction status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN wallet_transactions.balance_before IS 'Wallet balance before this transaction';
COMMENT ON COLUMN wallet_transactions.balance_after IS 'Wallet balance after this transaction';
COMMENT ON COLUMN wallet_transactions.payment_order_id IS 'Razorpay order ID for recharges';
COMMENT ON COLUMN wallet_transactions.payment_transaction_id IS 'Razorpay payment ID / payout ID';
COMMENT ON COLUMN wallet_transactions.upi_id IS 'UPI ID for redemptions/payouts';
COMMENT ON COLUMN wallet_transactions.related_user_id IS 'Recipient user ID for debits (payments to influencers)';

COMMENT ON TABLE hype_stores IS 'Stores brand store information for the Hype Store marketplace';
COMMENT ON COLUMN hype_stores.brand_id IS 'Foreign key to brands table';
COMMENT ON COLUMN hype_stores.store_slug IS 'URL-friendly store identifier';
COMMENT ON COLUMN hype_stores.is_verified IS 'Whether store is verified by admin';

COMMENT ON TABLE wallet_recharge_limits IS 'Defines recharge limits for different user types';
COMMENT ON COLUMN wallet_recharge_limits.min_recharge_amount IS 'Minimum amount that can be recharged in a single transaction (Rs 5,000 for brands)';
COMMENT ON COLUMN wallet_recharge_limits.max_recharge_amount IS 'Maximum amount that can be recharged in a single transaction (NULL = no limit)';
