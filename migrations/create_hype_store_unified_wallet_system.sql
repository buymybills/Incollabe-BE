-- Create Hype Store Unified Wallet System
-- Date: 2026-03-06
-- Description: Creates unified wallet system for BOTH brands and influencers specifically for hype store

-- =====================================================
-- 1. HYPE STORE WALLET TABLE (For Brands AND Influencers)
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_wallet (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('brand', 'influencer')),

    -- Balance tracking
    balance DECIMAL(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
    total_added DECIMAL(15, 2) DEFAULT 0.00,  -- Brand recharges OR influencer cashback received
    total_spent DECIMAL(15, 2) DEFAULT 0.00,  -- Brand cashback sent OR influencer withdrawals

    -- Additional tracking for influencers
    total_cashback_received DECIMAL(15, 2) DEFAULT 0.00,  -- For influencers
    total_withdrawn DECIMAL(15, 2) DEFAULT 0.00,  -- For influencers

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- One wallet per user
    UNIQUE(user_id, user_type)
);

-- Indexes
CREATE INDEX idx_hype_store_wallet_user ON hype_store_wallet(user_id, user_type);
CREATE INDEX idx_hype_store_wallet_active ON hype_store_wallet(is_active);
CREATE INDEX idx_hype_store_wallet_brand ON hype_store_wallet(user_id) WHERE user_type = 'brand';
CREATE INDEX idx_hype_store_wallet_influencer ON hype_store_wallet(user_id) WHERE user_type = 'influencer';

-- Comments
COMMENT ON TABLE hype_store_wallet IS 'Unified wallet system for hype store - handles both brands (who fund cashback) and influencers (who receive cashback)';
COMMENT ON COLUMN hype_store_wallet.user_id IS 'Foreign key to brands.id OR influencers.id depending on user_type';
COMMENT ON COLUMN hype_store_wallet.user_type IS 'Type of user: brand or influencer';
COMMENT ON COLUMN hype_store_wallet.balance IS 'Current wallet balance in Rs';
COMMENT ON COLUMN hype_store_wallet.total_added IS 'Brands: money recharged | Influencers: total cashback received';
COMMENT ON COLUMN hype_store_wallet.total_spent IS 'Brands: cashback paid out | Influencers: total withdrawn';

-- =====================================================
-- 2. HYPE STORE WALLET TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_wallet_transactions (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES hype_store(id) ON DELETE SET NULL,  -- Optional: which store the transaction relates to

    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL CHECK (
        transaction_type IN (
            'ADD_MONEY',        -- Brand adds money via Razorpay
            'CASHBACK_DEBIT',   -- Brand pays cashback to influencer
            'CASHBACK_CREDIT',  -- Influencer receives cashback
            'WITHDRAWAL',       -- Influencer withdraws to bank/UPI
            'REFUND',          -- Money refunded to wallet
            'ADJUSTMENT'       -- Admin adjustment
        )
    ),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    previous_balance DECIMAL(15, 2) NOT NULL,
    new_balance DECIMAL(15, 2) NOT NULL,

    -- Payment gateway details
    payment_method VARCHAR(50),  -- 'RAZORPAY', 'UPI', 'BANK_TRANSFER'
    payment_reference_id VARCHAR(255),
    payment_order_id VARCHAR(255),

    -- For influencer withdrawals
    upi_id VARCHAR(255),
    bank_account_number VARCHAR(100),
    ifsc_code VARCHAR(20),

    -- Related entities
    related_user_id INTEGER,      -- For cashback: recipient influencer ID OR sender brand ID
    related_user_type VARCHAR(20),
    order_id INTEGER REFERENCES hype_store_orders(id) ON DELETE SET NULL,  -- Link to order if applicable

    -- Status tracking
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    description TEXT,
    notes TEXT,
    metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hype_store_wallet_txn_wallet ON hype_store_wallet_transactions(wallet_id);
CREATE INDEX idx_hype_store_wallet_txn_store ON hype_store_wallet_transactions(store_id);
CREATE INDEX idx_hype_store_wallet_txn_type ON hype_store_wallet_transactions(transaction_type);
CREATE INDEX idx_hype_store_wallet_txn_status ON hype_store_wallet_transactions(status);
CREATE INDEX idx_hype_store_wallet_txn_created ON hype_store_wallet_transactions(created_at DESC);
CREATE INDEX idx_hype_store_wallet_txn_order ON hype_store_wallet_transactions(order_id) WHERE order_id IS NOT NULL;

-- Comments
COMMENT ON TABLE hype_store_wallet_transactions IS 'All wallet transactions for hype store - recharges, cashback, withdrawals';
COMMENT ON COLUMN hype_store_wallet_transactions.transaction_type IS 'ADD_MONEY (brand), CASHBACK_DEBIT (brand pays), CASHBACK_CREDIT (influencer receives), WITHDRAWAL (influencer)';
COMMENT ON COLUMN hype_store_wallet_transactions.store_id IS 'Optional: NULL for brand recharges, set for store-specific cashback transactions';
COMMENT ON COLUMN hype_store_wallet_transactions.related_user_id IS 'For cashback: the other party involved (brand paying OR influencer receiving)';

-- =====================================================
-- 3. WALLET RECHARGE LIMITS
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_wallet_recharge_limits (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('brand', 'influencer')),
    min_recharge_amount DECIMAL(10, 2) NOT NULL DEFAULT 5000.00,
    max_recharge_amount DECIMAL(10, 2),  -- NULL = no limit
    daily_recharge_limit DECIMAL(10, 2),
    monthly_recharge_limit DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_type)
);

-- Insert default limits
INSERT INTO hype_store_wallet_recharge_limits (user_type, min_recharge_amount, max_recharge_amount)
VALUES
    ('brand', 5000.00, NULL),       -- Brands: Min Rs 5,000, no maximum
    ('influencer', 0.00, NULL)       -- Influencers: Cannot add money, only receive
ON CONFLICT (user_type) DO NOTHING;

COMMENT ON TABLE hype_store_wallet_recharge_limits IS 'Recharge limits for hype store wallets';
COMMENT ON COLUMN hype_store_wallet_recharge_limits.min_recharge_amount IS 'Minimum recharge amount (Rs 5,000 for brands, Rs 0 for influencers who cannot add money)';

-- =====================================================
-- 4. WITHDRAWAL REQUESTS TABLE (For Influencers)
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_withdrawal_requests (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

    -- Withdrawal details
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    withdrawal_method VARCHAR(50) NOT NULL CHECK (withdrawal_method IN ('UPI', 'BANK_TRANSFER')),

    -- Payment details
    upi_id VARCHAR(255),
    bank_account_number VARCHAR(100),
    ifsc_code VARCHAR(20),
    account_holder_name VARCHAR(255),

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')
    ),

    -- Processing details
    razorpay_payout_id VARCHAR(255),
    processed_by INTEGER,  -- Admin ID who processed
    processed_at TIMESTAMP,
    rejected_reason TEXT,
    failed_reason TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_withdrawal_requests_wallet ON hype_store_withdrawal_requests(wallet_id);
CREATE INDEX idx_withdrawal_requests_influencer ON hype_store_withdrawal_requests(influencer_id);
CREATE INDEX idx_withdrawal_requests_status ON hype_store_withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created ON hype_store_withdrawal_requests(created_at DESC);

COMMENT ON TABLE hype_store_withdrawal_requests IS 'Withdrawal requests from influencers to get money from their hype store wallets';
COMMENT ON COLUMN hype_store_withdrawal_requests.status IS 'pending -> approved -> processing -> completed OR rejected/failed';
