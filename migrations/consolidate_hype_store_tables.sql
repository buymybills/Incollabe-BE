-- Consolidate hype_store (old) and hype_stores (new) into single hype_stores table
-- Date: 2026-03-10

-- =====================================================
-- 1. Copy data from old hype_store to new hype_stores
-- =====================================================
DO $$
BEGIN
    -- Only copy if old table has data
    IF EXISTS (SELECT 1 FROM hype_store LIMIT 1) THEN
        -- Insert data from old table to new table
        INSERT INTO hype_stores (
            id,
            brand_id,
            store_name,
            store_description,
            store_logo,
            store_banner,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            id,
            brand_id,
            store_name,
            store_description,
            logo_url,  -- maps to store_logo
            banner_image_url,  -- maps to store_banner
            is_active,
            created_at,
            updated_at
        FROM hype_store
        WHERE NOT EXISTS (
            SELECT 1 FROM hype_stores WHERE hype_stores.id = hype_store.id
        );

        -- Update sequence to continue from max ID
        PERFORM setval('hype_stores_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM hype_stores));

        RAISE NOTICE '✅ Copied data from hype_store to hype_stores';
    ELSE
        RAISE NOTICE 'ℹ️  Old hype_store table is empty, nothing to copy';
    END IF;
END $$;

-- =====================================================
-- 2. Update foreign keys to point to new table
-- =====================================================
DO $$
BEGIN
    -- Drop old foreign keys
    ALTER TABLE hype_store_cashback_config DROP CONSTRAINT IF EXISTS hype_store_cashback_config_store_id_fkey;
    ALTER TABLE hype_store_cashback_transactions DROP CONSTRAINT IF EXISTS hype_store_cashback_transactions_store_id_fkey;
    ALTER TABLE hype_store_creator_preferences DROP CONSTRAINT IF EXISTS hype_store_creator_preferences_store_id_fkey;
    ALTER TABLE hype_store_orders DROP CONSTRAINT IF EXISTS hype_store_orders_store_id_fkey;
    ALTER TABLE hype_store_wallet_transactions DROP CONSTRAINT IF EXISTS hype_store_wallet_transactions_store_id_fkey;

    -- Add new foreign keys pointing to hype_stores (plural)
    ALTER TABLE hype_store_cashback_config
    ADD CONSTRAINT hype_store_cashback_config_hype_store_id_fkey
    FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;

    ALTER TABLE hype_store_cashback_transactions
    ADD CONSTRAINT hype_store_cashback_transactions_hype_store_id_fkey
    FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;

    ALTER TABLE hype_store_creator_preferences
    ADD CONSTRAINT hype_store_creator_preferences_hype_store_id_fkey
    FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;

    ALTER TABLE hype_store_orders
    ADD CONSTRAINT hype_store_orders_hype_store_id_fkey
    FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;

    ALTER TABLE hype_store_wallet_transactions
    ADD CONSTRAINT hype_store_wallet_transactions_hype_store_id_fkey
    FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE SET NULL;

    RAISE NOTICE '✅ Updated foreign keys to point to hype_stores table';

    -- Drop old hype_store table (not CASCADE since we already updated FKs)
    DROP TABLE IF EXISTS hype_store;

    RAISE NOTICE '✅ Dropped old hype_store table';
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Table consolidation completed successfully!';
    RAISE NOTICE 'All data now in hype_stores (plural) table';
    RAISE NOTICE 'Old hype_store (singular) table removed';
END $$;
