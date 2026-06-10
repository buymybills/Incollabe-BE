-- Create Hype Store System Tables

-- 1. Main Hype Store Table
CREATE TABLE IF NOT EXISTS hype_store (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    store_description TEXT,
    banner_image_url TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    monthly_creator_limit INTEGER DEFAULT 5, -- Pilot run limit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(brand_id) -- One store per brand
);

-- 2. Cashback Configuration Table
CREATE TABLE IF NOT EXISTS hype_store_cashback_config (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,

    -- Reel/Post Cashback
    reel_post_min_cashback DECIMAL(10, 2) DEFAULT 2000,
    reel_post_max_cashback DECIMAL(10, 2) DEFAULT 12000,

    -- Story Cashback
    story_min_cashback DECIMAL(10, 2) DEFAULT 2000,
    story_max_cashback DECIMAL(10, 2) DEFAULT 12000,

    -- Monthly claim limit per creator
    monthly_claim_count INTEGER DEFAULT 3,

    -- Cashback claim strategy (PILOT_RUN, VALIDATE_ROI, etc.)
    claim_strategy VARCHAR(50) DEFAULT 'OPTIMIZED_SPEND',

    -- Cashback percentage (optional)
    cashback_percentage DECIMAL(5, 2) DEFAULT 20.0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id) -- One config per store
);

-- 3. Store Wallet Table
CREATE TABLE IF NOT EXISTS hype_store_wallet (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    total_added DECIMAL(15, 2) DEFAULT 0.00,
    total_spent DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id) -- One wallet per store
);

-- 4. Wallet Transactions Table (Add Money)
CREATE TABLE IF NOT EXISTS hype_store_wallet_transactions (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'ADD_MONEY', 'CASHBACK_DEBIT'
    amount DECIMAL(15, 2) NOT NULL,
    previous_balance DECIMAL(15, 2) NOT NULL,
    new_balance DECIMAL(15, 2) NOT NULL,
    description TEXT,
    payment_method VARCHAR(50), -- 'RAZORPAY', 'BANK_TRANSFER', etc.
    payment_reference_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Creator Preferences Table (Targeting Filters)
CREATE TABLE IF NOT EXISTS hype_store_creator_preferences (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,

    -- Influencer Type (follower count tiers)
    influencer_types JSONB DEFAULT '[]', -- ['BELOW_1K', 'NANO', 'MICRO', 'MID_TIER', 'MACRO', 'MEGA']

    -- Age Preference
    min_age INTEGER DEFAULT 18,
    max_age INTEGER DEFAULT 60,

    -- Gender Preference
    gender_preference JSONB DEFAULT '[]', -- ['MALE', 'FEMALE', 'OTHERS']

    -- Niche Categories
    niche_categories JSONB DEFAULT '[]', -- ['FASHION', 'BEAUTY', 'LIFESTYLE', 'FITNESS', etc.]

    -- Location Preferences
    preferred_locations JSONB DEFAULT '[]', -- ['Mumbai', 'Delhi NCR', 'Bangalore', etc.]
    is_pan_india BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id) -- One preference set per store
);

-- 6. Store Orders Table (Track influencer purchases)
CREATE TABLE IF NOT EXISTS hype_store_orders (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

    -- Order Details
    order_id VARCHAR(255) NOT NULL UNIQUE,
    external_order_id VARCHAR(255), -- From Shopify/external platform
    product_name TEXT NOT NULL,
    product_details TEXT,
    order_amount DECIMAL(10, 2) NOT NULL,

    -- Cashback Details
    cashback_percentage DECIMAL(5, 2),
    cashback_amount DECIMAL(10, 2) DEFAULT 0.00,
    cashback_status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'CANCELLED'
    cashback_sent_at TIMESTAMP,

    -- Promotion Content (Reel/Story)
    promotion_type VARCHAR(50), -- 'REEL', 'POST', 'STORY'
    promotion_content_url TEXT,
    promotion_posted_at TIMESTAMP,

    -- Performance Metrics
    expected_roi DECIMAL(5, 2),
    estimated_engagement INTEGER,
    estimated_reach INTEGER,
    influencer_tier VARCHAR(50), -- 'NANO', 'MICRO', 'ELITE', etc.

    order_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Cashback Transactions Table
CREATE TABLE IF NOT EXISTS hype_store_cashback_transactions (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES hype_store(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES hype_store_orders(id) ON DELETE CASCADE,
    influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    wallet_id INTEGER NOT NULL REFERENCES hype_store_wallet(id) ON DELETE CASCADE,

    cashback_amount DECIMAL(10, 2) NOT NULL,
    transaction_status VARCHAR(50) DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PENDING'
    transaction_reference_id VARCHAR(255),

    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Indexes for better performance
CREATE INDEX idx_hype_store_brand_id ON hype_store(brand_id);
CREATE INDEX idx_hype_store_wallet_store_id ON hype_store_wallet(store_id);
CREATE INDEX idx_hype_store_wallet_transactions_wallet_id ON hype_store_wallet_transactions(wallet_id);
CREATE INDEX idx_hype_store_wallet_transactions_store_id ON hype_store_wallet_transactions(store_id);
CREATE INDEX idx_hype_store_orders_store_id ON hype_store_orders(store_id);
CREATE INDEX idx_hype_store_orders_influencer_id ON hype_store_orders(influencer_id);
CREATE INDEX idx_hype_store_orders_order_id ON hype_store_orders(order_id);
CREATE INDEX idx_hype_store_cashback_transactions_store_id ON hype_store_cashback_transactions(store_id);
CREATE INDEX idx_hype_store_cashback_transactions_order_id ON hype_store_cashback_transactions(order_id);

-- Add comments for documentation
COMMENT ON TABLE hype_store IS 'Main table for brand hype stores';
COMMENT ON TABLE hype_store_cashback_config IS 'Cashback rules configuration per store';
COMMENT ON TABLE hype_store_wallet IS 'Wallet balance for each brand store';
COMMENT ON TABLE hype_store_wallet_transactions IS 'All wallet transactions (add money, cashback debits)';
COMMENT ON TABLE hype_store_creator_preferences IS 'Creator targeting filters set by brands';
COMMENT ON TABLE hype_store_orders IS 'Orders from influencers for tracking and analytics';
COMMENT ON TABLE hype_store_cashback_transactions IS 'Cashback sent to influencers';
