-- Rename store_id to hype_store_id in all hype store tables
-- This aligns the old migration schema with the new coupon-based system models
-- Date: 2026-03-10

-- Fix hype_store_orders table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'store_id'
    ) THEN
        ALTER TABLE hype_store_orders RENAME COLUMN store_id TO hype_store_id;
        RAISE NOTICE '✅ Renamed hype_store_orders.store_id to hype_store_id';
    ELSE
        RAISE NOTICE 'ℹ️  hype_store_orders.store_id already renamed or does not exist';
    END IF;
END $$;

-- Fix hype_store_cashback_config table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_cashback_config' AND column_name = 'store_id'
    ) THEN
        ALTER TABLE hype_store_cashback_config RENAME COLUMN store_id TO hype_store_id;
        RAISE NOTICE '✅ Renamed hype_store_cashback_config.store_id to hype_store_id';
    ELSE
        RAISE NOTICE 'ℹ️  hype_store_cashback_config.store_id already renamed or does not exist';
    END IF;
END $$;

-- Fix hype_store_creator_preferences table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_creator_preferences' AND column_name = 'store_id'
    ) THEN
        ALTER TABLE hype_store_creator_preferences RENAME COLUMN store_id TO hype_store_id;
        RAISE NOTICE '✅ Renamed hype_store_creator_preferences.store_id to hype_store_id';
    ELSE
        RAISE NOTICE 'ℹ️  hype_store_creator_preferences.store_id already renamed or does not exist';
    END IF;
END $$;

-- Fix hype_store_wallet_transactions table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_wallet_transactions' AND column_name = 'store_id'
    ) THEN
        ALTER TABLE hype_store_wallet_transactions RENAME COLUMN store_id TO hype_store_id;
        RAISE NOTICE '✅ Renamed hype_store_wallet_transactions.store_id to hype_store_id';
    ELSE
        RAISE NOTICE 'ℹ️  hype_store_wallet_transactions.store_id already renamed or does not exist';
    END IF;
END $$;

-- Fix hype_store_cashback_transactions table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_cashback_transactions' AND column_name = 'store_id'
    ) THEN
        ALTER TABLE hype_store_cashback_transactions RENAME COLUMN store_id TO hype_store_id;
        RAISE NOTICE '✅ Renamed hype_store_cashback_transactions.store_id to hype_store_id';
    ELSE
        RAISE NOTICE 'ℹ️  hype_store_cashback_transactions.store_id already renamed or does not exist';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Column renaming completed successfully!';
    RAISE NOTICE 'All store_id columns have been renamed to hype_store_id';
    RAISE NOTICE 'This aligns the schema with the new coupon-based affiliate system models';
END $$;
