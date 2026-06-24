-- HYPE Platform Foundation Migration
-- Creates all new tables and alters existing tables

-- 1. consumers table
CREATE TABLE IF NOT EXISTS consumers (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  phone_hash VARCHAR UNIQUE,
  fcm_token VARCHAR,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. influencer_invite_codes table
CREATE TABLE IF NOT EXISTS influencer_invite_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE NOT NULL,
  created_by INTEGER,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  total_used INTEGER DEFAULT 0 NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. post_categories table
CREATE TABLE IF NOT EXISTS post_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  icon_url VARCHAR,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. post_subcategories table
CREATE TABLE IF NOT EXISTS post_subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES post_categories(id),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(category_id, slug)
);

-- 5. hype_reel_products table
CREATE TABLE IF NOT EXISTS hype_reel_products (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  hype_store_order_id INTEGER REFERENCES hype_store_orders(id),
  hype_store_id INTEGER REFERENCES hype_stores(id),
  product_name VARCHAR,
  product_brand VARCHAR,
  product_size VARCHAR,
  product_thumbnail_url TEXT,
  affiliate_link TEXT,
  product_rating DECIMAL(3,1),
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hype_reel_products_post_id ON hype_reel_products(post_id);

-- 6. affiliate_earnings table
CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  post_id INTEGER REFERENCES posts(id),
  hype_store_order_id INTEGER REFERENCES hype_store_orders(id),
  hype_store_id INTEGER NOT NULL REFERENCES hype_stores(id),
  brand_name VARCHAR,
  product_name VARCHAR,
  product_thumbnail_url VARCHAR,
  affiliate_id VARCHAR,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR DEFAULT 'pending' NOT NULL,
  referral_click_id INTEGER REFERENCES hype_store_referral_clicks(id),
  earned_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_influencer_id ON affiliate_earnings(influencer_id);

-- 7. influencer_withdrawal_accounts table
CREATE TABLE IF NOT EXISTS influencer_withdrawal_accounts (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  account_type VARCHAR NOT NULL,
  upi_id VARCHAR,
  account_holder_name VARCHAR,
  account_number TEXT,
  bank_name VARCHAR,
  ifsc_code VARCHAR,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 8. Alter influencers table
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR,
  ADD COLUMN IF NOT EXISTS is_hype_influencer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hype_influencer_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hype_reels_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hype_level_updated_at TIMESTAMP;

-- 9. Alter posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_type VARCHAR DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS is_hype_reel BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS post_category_id INTEGER REFERENCES post_categories(id),
  ADD COLUMN IF NOT EXISTS post_subcategory_id INTEGER REFERENCES post_subcategories(id),
  ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR,
  ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS collaborator_id INTEGER REFERENCES influencers(id),
  ADD COLUMN IF NOT EXISTS collaborator_status VARCHAR;

-- 10. Alter wallets table
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS affiliate_earnings_balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_affiliate_earned DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_affiliate_withdrawn DECIMAL(10,2) DEFAULT 0;

-- 11. Alter hype_store_referral_clicks table
ALTER TABLE hype_store_referral_clicks
  ADD COLUMN IF NOT EXISTS country VARCHAR,
  ADD COLUMN IF NOT EXISTS city VARCHAR;
