-- Fix hype_stores table schema to match new models
-- Date: 2026-03-10

-- =====================================================
-- 1. Rename table from hype_store to hype_stores (if needed)
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hype_store'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hype_stores'
    ) THEN
        ALTER TABLE hype_store RENAME TO hype_stores;
        RAISE NOTICE '✅ Renamed table hype_store to hype_stores';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hype_stores'
    ) THEN
        RAISE NOTICE 'ℹ️  Table hype_stores already exists';
    ELSE
        RAISE NOTICE '⚠️  Neither hype_store nor hype_stores table exists';
    END IF;
END $$;

-- =====================================================
-- 2. Rename columns to match model expectations
-- =====================================================
DO $$
BEGIN
    -- Rename banner_image_url to store_banner
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'banner_image_url'
    ) THEN
        ALTER TABLE hype_stores RENAME COLUMN banner_image_url TO store_banner;
        RAISE NOTICE '✅ Renamed banner_image_url to store_banner';
    ELSE
        RAISE NOTICE 'ℹ️  store_banner already exists or banner_image_url does not exist';
    END IF;

    -- Rename logo_url to store_logo
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE hype_stores RENAME COLUMN logo_url TO store_logo;
        RAISE NOTICE '✅ Renamed logo_url to store_logo';
    ELSE
        RAISE NOTICE 'ℹ️  store_logo already exists or logo_url does not exist';
    END IF;
END $$;

-- =====================================================
-- 3. Add missing columns if needed
-- =====================================================
DO $$
BEGIN
    -- Add store_slug if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'store_slug'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN store_slug VARCHAR(255) UNIQUE;

        -- Generate slugs for existing stores
        UPDATE hype_stores
        SET store_slug = LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE store_slug IS NULL;

        CREATE INDEX idx_hype_stores_slug ON hype_stores(store_slug);

        RAISE NOTICE '✅ Added store_slug column';
    ELSE
        RAISE NOTICE 'ℹ️  store_slug already exists';
    END IF;

    -- Add is_verified if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

        RAISE NOTICE '✅ Added is_verified column';
    ELSE
        RAISE NOTICE 'ℹ️  is_verified already exists';
    END IF;

    -- Add min_order_value if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'min_order_value'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN min_order_value DECIMAL(10, 2) DEFAULT 0.00;

        RAISE NOTICE '✅ Added min_order_value column';
    ELSE
        RAISE NOTICE 'ℹ️  min_order_value already exists';
    END IF;

    -- Add max_order_value if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'max_order_value'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN max_order_value DECIMAL(10, 2);

        RAISE NOTICE '✅ Added max_order_value column';
    ELSE
        RAISE NOTICE 'ℹ️  max_order_value already exists';
    END IF;

    -- Add total_orders if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'total_orders'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN total_orders INTEGER DEFAULT 0;

        RAISE NOTICE '✅ Added total_orders column';
    ELSE
        RAISE NOTICE 'ℹ️  total_orders already exists';
    END IF;

    -- Add total_revenue if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'total_revenue'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN total_revenue DECIMAL(12, 2) DEFAULT 0.00;

        RAISE NOTICE '✅ Added total_revenue column';
    ELSE
        RAISE NOTICE 'ℹ️  total_revenue already exists';
    END IF;

    -- Add total_cashback_given if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'total_cashback_given'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN total_cashback_given DECIMAL(12, 2) DEFAULT 0.00;

        RAISE NOTICE '✅ Added total_cashback_given column';
    ELSE
        RAISE NOTICE 'ℹ️  total_cashback_given already exists';
    END IF;

    -- Add settings if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_stores' AND column_name = 'settings'
    ) THEN
        ALTER TABLE hype_stores
        ADD COLUMN settings JSONB;

        RAISE NOTICE '✅ Added settings column';
    ELSE
        RAISE NOTICE 'ℹ️  settings already exists';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ hype_stores table schema updated successfully!';
    RAISE NOTICE 'Table renamed: hype_store → hype_stores';
    RAISE NOTICE 'Columns renamed: banner_image_url → store_banner, logo_url → store_logo';
    RAISE NOTICE 'Missing columns added for new coupon-based system';
END $$;
