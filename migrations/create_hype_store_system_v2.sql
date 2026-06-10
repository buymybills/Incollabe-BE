-- Create Hype Store System Tables (V2 - Brand-Level Wallet)
-- Date: 2026-03-06
-- Description: Creates hype store system with brand-level wallet (multiple stores per brand)

-- =====================================================
-- 1. MAIN HYPE STORE TABLE
-- =====================================================
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
    -- NOTE: No UNIQUE constraint on brand_id - brands can have multiple stores
);

-- =====================================================
-- 2. CASHBACK CONFIGURATION TABLE (Per Store)
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_cashback_config (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,

    -- Reel/Post Cashback
    reel_post_min_cashback DECIMAL(10, 2) DEFAULT 100,  -- Fixed at Rs 100
    reel_post_max_cashback DECIMAL(10, 2) DEFAULT 12000,

    -- Story Cashback
    story_min_cashback DECIMAL(10, 2) DEFAULT 100,  -- Fixed at Rs 100
    story_max_cashback DECIMAL(10, 2) DEFAULT 12000,

    -- Monthly claim limit per creator
    monthly_claim_count INTEGER DEFAULT 3,

    -- Cashback claim strategy
    claim_strategy VARCHAR(50) DEFAULT 'OPTIMIZED_SPEND',

    -- Cashback percentage
    cashback_percentage DECIMAL(5, 2) DEFAULT 20.0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id)
);

-- =====================================================
-- 3. STORE WALLET TABLE (Brand-Level - Shared Across Stores)
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_wallet (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    total_added DECIMAL(15, 2) DEFAULT 0.00,
    total_spent DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(brand_id)  -- One wallet per brand
);

-- =====================================================
-- 4. WALLET TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_wallet_transactions (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES hype_store(id) ON DELETE SET NULL,  -- Nullable for brand-level transactions
    transaction_type VARCHAR(50) NOT NULL,  -- 'ADD_MONEY', 'CASHBACK_DEBIT'
    amount DECIMAL(15, 2) NOT NULL,
    previous_balance DECIMAL(15, 2) NOT NULL,
    new_balance DECIMAL(15, 2) NOT NULL,
    description TEXT,
    payment_method VARCHAR(50),  -- 'RAZORPAY', 'BANK_TRANSFER', etc.
    payment_reference_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 5. CREATOR PREFERENCES TABLE (Per Store)
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_creator_preferences (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,

    -- Influencer Type
    influencer_types JSONB DEFAULT '[]',

    -- Age Preference
    min_age INTEGER DEFAULT 18,
    max_age INTEGER DEFAULT 60,

    -- Gender Preference
    gender_preference JSONB DEFAULT '[]',

    -- Niche Categories
    niche_categories JSONB DEFAULT '[]',

    -- Location Preferences
    preferred_locations JSONB DEFAULT '[]',
    is_pan_india BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id)
);

-- =====================================================
-- 6. STORE ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS hype_store_orders (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

    -- Order Details
    order_id VARCHAR(255) NOT NULL UNIQUE,
    external_order_id VARCHAR(255),
    product_name TEXT NOT NULL,
    product_details TEXT,
    order_amount DECIMAL(10, 2) NOT NULL,

    -- Cashback Details
    cashback_percentage DECIMAL(5, 2),
    cashback_amount DECIMAL(10, 2) DEFAULT 0.00,
    cashback_status VARCHAR(50) DEFAULT 'PENDING',
    cashback_sent_at TIMESTAMP,

    -- Promotion Content
    promotion_type VARCHAR(50),
    promotion_content_url TEXT,
    promotion_posted_at TIMESTAMP,

    -- Performance Metrics
    expected_roi DECIMAL(5, 2),
    estimated_engagement INTEGER,
    estimated_reach INTEGER,
    influencer_tier VARCHAR(50),

    order_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 7. CASHBACK TRANSACTIONS TABLE
-- =====================================================
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

-- =====================================================
-- 8. CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_hype_store_brand_id ON hype_store(brand_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_wallet_brand_id ON hype_store_wallet(brand_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_wallet_transactions_wallet_id ON hype_store_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_wallet_transactions_store_id ON hype_store_wallet_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_store_id ON hype_store_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_influencer_id ON hype_store_orders(influencer_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_orders_order_id ON hype_store_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_cashback_transactions_store_id ON hype_store_cashback_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_hype_store_cashback_transactions_order_id ON hype_store_cashback_transactions(order_id);

-- =====================================================
-- 9. ADD COMMENTS
-- =====================================================
COMMENT ON TABLE hype_store IS 'Brand stores - multiple stores allowed per brand (Store 1, Store 2, etc.)';
COMMENT ON TABLE hype_store_cashback_config IS 'Cashback configuration per store';
COMMENT ON TABLE hype_store_wallet IS 'Brand wallet - ONE per brand, shared across all their stores';
COMMENT ON TABLE hype_store_wallet_transactions IS 'Wallet transactions - store_id is optional for brand-level transactions';
COMMENT ON TABLE hype_store_creator_preferences IS 'Creator targeting preferences per store';
COMMENT ON TABLE hype_store_orders IS 'Orders from influencers';
COMMENT ON TABLE hype_store_cashback_transactions IS 'Cashback sent to influencers';

COMMENT ON COLUMN hype_store_wallet.brand_id IS 'One wallet per brand, shared across all stores';
COMMENT ON COLUMN hype_store_wallet_transactions.store_id IS 'Optional: NULL for brand-level transactions like ADD_MONEY, set for store-specific cashback debits';
COMMENT ON COLUMN hype_store_cashback_config.reel_post_min_cashback IS 'Minimum cashback for reel/post - fixed at Rs 100';
COMMENT ON COLUMN hype_store_cashback_config.story_min_cashback IS 'Minimum cashback for story - fixed at Rs 100';
