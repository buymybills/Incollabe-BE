-- Complete Hype Store System Migration
-- Date: 2026-03-06
-- Description: Complete hype store system with unified wallet for brands and influencers

-- =====================================================
-- PART 1: HYPE STORE TABLES
-- =====================================================

-- 1. Main Hype Store Table
CREATE TABLE IF NOT EXISTS hype_store (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    store_description TEXT,
    banner_image_url TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    monthly_creator_limit INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
    -- No UNIQUE on brand_id - allows multiple stores per brand
);

CREATE INDEX idx_hype_store_brand_id ON hype_store(brand_id);

COMMENT ON TABLE hype_store IS 'Brand stores - multiple stores allowed per brand (Store 1, Store 2, etc.)';

-- 2. Cashback Configuration (Per Store)
CREATE TABLE IF NOT EXISTS hype_store_cashback_config (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    reel_post_min_cashback DECIMAL(10, 2) DEFAULT 100,
    reel_post_max_cashback DECIMAL(10, 2) DEFAULT 12000,
    story_min_cashback DECIMAL(10, 2) DEFAULT 100,
    story_max_cashback DECIMAL(10, 2) DEFAULT 12000,
    monthly_claim_count INTEGER DEFAULT 3,
    claim_strategy VARCHAR(50) DEFAULT 'OPTIMIZED_SPEND',
    cashback_percentage DECIMAL(5, 2) DEFAULT 20.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id)
);

COMMENT ON TABLE hype_store_cashback_config IS 'Cashback configuration per store';
COMMENT ON COLUMN hype_store_cashback_config.reel_post_min_cashback IS 'Fixed at Rs 100';
COMMENT ON COLUMN hype_store_cashback_config.story_min_cashback IS 'Fixed at Rs 100';

-- 3. Creator Preferences (Per Store)
CREATE TABLE IF NOT EXISTS hype_store_creator_preferences (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    influencer_types JSONB DEFAULT '[]',
    min_age INTEGER DEFAULT 18,
    max_age INTEGER DEFAULT 60,
    gender_preference JSONB DEFAULT '[]',
    niche_categories JSONB DEFAULT '[]',
    preferred_locations JSONB DEFAULT '[]',
    is_pan_india BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id)
);

COMMENT ON TABLE hype_store_creator_preferences IS 'Creator targeting preferences per store';

-- =====================================================
-- PART 2: UNIFIED WALLET SYSTEM (Brands + Influencers)
-- =====================================================

-- 4. Unified Wallet Table
CREATE TABLE IF NOT EXISTS hype_store_wallet (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('brand', 'influencer')),
    balance DECIMAL(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
    total_added DECIMAL(15, 2) DEFAULT 0.00,
    total_spent DECIMAL(15, 2) DEFAULT 0.00,
    total_cashback_received DECIMAL(15, 2) DEFAULT 0.00,
    total_withdrawn DECIMAL(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, user_type)
);

CREATE INDEX idx_hype_store_wallet_user ON hype_store_wallet(user_id, user_type);
CREATE INDEX idx_hype_store_wallet_brand ON hype_store_wallet(user_id) WHERE user_type = 'brand';
CREATE INDEX idx_hype_store_wallet_influencer ON hype_store_wallet(user_id) WHERE user_type = 'influencer';

COMMENT ON TABLE hype_store_wallet IS 'Unified wallet for hype store - brands (fund cashback) and influencers (receive cashback)';
COMMENT ON COLUMN hype_store_wallet.user_id IS 'brands.id OR influencers.id depending on user_type';

-- 5. Wallet Transactions
CREATE TABLE IF NOT EXISTS hype_store_wallet_transactions (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES hype_store(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (
        transaction_type IN ('ADD_MONEY', 'CASHBACK_DEBIT', 'CASHBACK_CREDIT', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT')
    ),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    previous_balance DECIMAL(15, 2) NOT NULL,
    new_balance DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_reference_id VARCHAR(255),
    payment_order_id VARCHAR(255),
    upi_id VARCHAR(255),
    bank_account_number VARCHAR(100),
    ifsc_code VARCHAR(20),
    related_user_id INTEGER,
    related_user_type VARCHAR(20),
    order_id INTEGER,  -- Will add FK after orders table created
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    description TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hype_store_wallet_txn_wallet ON hype_store_wallet_transactions(wallet_id);
CREATE INDEX idx_hype_store_wallet_txn_store ON hype_store_wallet_transactions(store_id);
CREATE INDEX idx_hype_store_wallet_txn_type ON hype_store_wallet_transactions(transaction_type);

COMMENT ON TABLE hype_store_wallet_transactions IS 'All wallet transactions - recharges, cashback, withdrawals';

-- 6. Wallet Recharge Limits
CREATE TABLE IF NOT EXISTS hype_store_wallet_recharge_limits (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('brand', 'influencer')),
    min_recharge_amount DECIMAL(10, 2) NOT NULL DEFAULT 5000.00,
    max_recharge_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_type)
);

INSERT INTO hype_store_wallet_recharge_limits (user_type, min_recharge_amount, max_recharge_amount)
VALUES
    ('brand', 5000.00, NULL),
    ('influencer', 0.00, NULL)
ON CONFLICT (user_type) DO NOTHING;

-- 7. Withdrawal Requests (For Influencers)
CREATE TABLE IF NOT EXISTS hype_store_withdrawal_requests (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    withdrawal_method VARCHAR(50) NOT NULL CHECK (withdrawal_method IN ('UPI', 'BANK_TRANSFER')),
    upi_id VARCHAR(255),
    bank_account_number VARCHAR(100),
    ifsc_code VARCHAR(20),
    account_holder_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')
    ),
    razorpay_payout_id VARCHAR(255),
    processed_by INTEGER,
    processed_at TIMESTAMP,
    rejected_reason TEXT,
    failed_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_requests_wallet ON hype_store_withdrawal_requests(wallet_id);
CREATE INDEX idx_withdrawal_requests_influencer ON hype_store_withdrawal_requests(influencer_id);
CREATE INDEX idx_withdrawal_requests_status ON hype_store_withdrawal_requests(status);

-- =====================================================
-- PART 3: ORDERS & CASHBACK TRACKING
-- =====================================================

-- 8. Store Orders
CREATE TABLE IF NOT EXISTS hype_store_orders (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    external_order_id VARCHAR(255),
    product_name TEXT NOT NULL,
    product_details TEXT,
    order_amount DECIMAL(10, 2) NOT NULL,
    cashback_percentage DECIMAL(5, 2),
    cashback_amount DECIMAL(10, 2) DEFAULT 0.00,
    cashback_status VARCHAR(50) DEFAULT 'PENDING',
    cashback_sent_at TIMESTAMP,
    promotion_type VARCHAR(50),
    promotion_content_url TEXT,
    promotion_posted_at TIMESTAMP,
    expected_roi DECIMAL(5, 2),
    estimated_engagement INTEGER,
    estimated_reach INTEGER,
    influencer_tier VARCHAR(50),
    order_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hype_store_orders_store_id ON hype_store_orders(store_id);
CREATE INDEX idx_hype_store_orders_influencer_id ON hype_store_orders(influencer_id);
CREATE INDEX idx_hype_store_orders_order_id ON hype_store_orders(order_id);

-- Now add FK to wallet_transactions
ALTER TABLE hype_store_wallet_transactions
ADD CONSTRAINT fk_wallet_txn_order
FOREIGN KEY (order_id) REFERENCES hype_store_orders(id) ON DELETE SET NULL;

-- 9. Cashback Transactions
CREATE TABLE IF NOT EXISTS hype_store_cashback_transactions (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES hype_store_orders(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    cashback_amount DECIMAL(10, 2) NOT NULL,
    transaction_status VARCHAR(50) DEFAULT 'SUCCESS',
    transaction_reference_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hype_store_cashback_txn_store ON hype_store_cashback_transactions(store_id);
CREATE INDEX idx_hype_store_cashback_txn_order ON hype_store_cashback_transactions(order_id);

COMMENT ON TABLE hype_store_orders IS 'Orders from influencers for tracking and analytics';
COMMENT ON TABLE hype_store_cashback_transactions IS 'Cashback sent to influencers';

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Hype Store System Created Successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '- hype_store (multiple stores per brand)';
    RAISE NOTICE '- hype_store_cashback_config (min cashback: Rs 100)';
    RAISE NOTICE '- hype_store_creator_preferences';
    RAISE NOTICE '- hype_store_wallet (unified for brands + influencers)';
    RAISE NOTICE '- hype_store_wallet_transactions';
    RAISE NOTICE '- hype_store_wallet_recharge_limits';
    RAISE NOTICE '- hype_store_withdrawal_requests';
    RAISE NOTICE '- hype_store_orders';
    RAISE NOTICE '- hype_store_cashback_transactions';
END $$;
