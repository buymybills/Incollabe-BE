-- Recover missing hype store records after consolidation failure
-- Date: 2026-03-10
--
-- CONTEXT: The consolidation migration dropped hype_store table
-- but data was not copied to hype_stores table first.
-- This recovers the 2 stores (IDs 1 and 2) that existed based on
-- cashback_config and creator_preferences tables.

DO $$
DECLARE
    brand1_id INTEGER;
    brand2_id INTEGER;
BEGIN
    -- Find first 2 brands that don't already have stores
    SELECT id INTO brand1_id FROM brands
    WHERE id NOT IN (SELECT brand_id FROM hype_stores WHERE brand_id IS NOT NULL)
    ORDER BY id LIMIT 1;

    SELECT id INTO brand2_id FROM brands
    WHERE id NOT IN (SELECT brand_id FROM hype_stores WHERE brand_id IS NOT NULL)
    AND id != brand1_id
    ORDER BY id LIMIT 1 OFFSET 1;

    -- If no brands found, use IDs 1 and 2
    IF brand1_id IS NULL THEN
        brand1_id := 1;
    END IF;

    IF brand2_id IS NULL THEN
        brand2_id := 2;
    END IF;

    RAISE NOTICE 'Using brand IDs: % and %', brand1_id, brand2_id;

    -- Insert store 1 if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM hype_stores WHERE id = 1) THEN
        INSERT INTO hype_stores (
            id,
            brand_id,
            store_name,
            store_description,
            store_slug,
            is_active,
            is_verified,
            min_order_value,
            total_orders,
            total_revenue,
            total_cashback_given,
            created_at,
            updated_at
        ) VALUES (
            1,
            brand1_id,
            'Hype Store 1',
            'Recovered store - please update with correct details',
            'hype-store-1',
            true,
            false,
            0.00,
            0,
            0.00,
            0.00,
            '2026-03-07 09:39:54.158',
            '2026-03-07 09:39:54.158'
        );
        RAISE NOTICE '✅ Recovered store ID 1 with brand_id %', brand1_id;
    ELSE
        RAISE NOTICE 'ℹ️  Store ID 1 already exists';
    END IF;

    -- Insert store 2 if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM hype_stores WHERE id = 2) THEN
        INSERT INTO hype_stores (
            id,
            brand_id,
            store_name,
            store_description,
            store_slug,
            is_active,
            is_verified,
            min_order_value,
            total_orders,
            total_revenue,
            total_cashback_given,
            created_at,
            updated_at
        ) VALUES (
            2,
            brand2_id,
            'Hype Store 2',
            'Recovered store - please update with correct details',
            'hype-store-2',
            true,
            false,
            0.00,
            0,
            0.00,
            0.00,
            '2026-03-07 11:23:28.757',
            '2026-03-07 11:23:28.757'
        );
        RAISE NOTICE '✅ Recovered store ID 2 with brand_id %', brand2_id;
    ELSE
        RAISE NOTICE 'ℹ️  Store ID 2 already exists';
    END IF;

    -- Update sequence to continue from max ID
    PERFORM setval('hype_stores_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM hype_stores));
    RAISE NOTICE '✅ Updated sequence';

END $$;

-- Now add the missing foreign key constraints
DO $$
BEGIN
    -- Add foreign key for cashback_config
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'hype_store_cashback_config_hype_store_id_fkey'
    ) THEN
        ALTER TABLE hype_store_cashback_config
        ADD CONSTRAINT hype_store_cashback_config_hype_store_id_fkey
        FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for cashback_config';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key for cashback_config already exists';
    END IF;

    -- Add foreign key for creator_preferences
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'hype_store_creator_preferences_hype_store_id_fkey'
    ) THEN
        ALTER TABLE hype_store_creator_preferences
        ADD CONSTRAINT hype_store_creator_preferences_hype_store_id_fkey
        FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for creator_preferences';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key for creator_preferences already exists';
    END IF;

    -- Add foreign key for orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'hype_store_orders_hype_store_id_fkey'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD CONSTRAINT hype_store_orders_hype_store_id_fkey
        FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for orders';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key for orders already exists';
    END IF;

    -- Add foreign key for cashback_transactions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'hype_store_cashback_transactions_hype_store_id_fkey'
    ) THEN
        ALTER TABLE hype_store_cashback_transactions
        ADD CONSTRAINT hype_store_cashback_transactions_hype_store_id_fkey
        FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for cashback_transactions';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key for cashback_transactions already exists';
    END IF;

    -- Add foreign key for wallet_transactions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'hype_store_wallet_transactions_hype_store_id_fkey'
    ) THEN
        ALTER TABLE hype_store_wallet_transactions
        ADD CONSTRAINT hype_store_wallet_transactions_hype_store_id_fkey
        FOREIGN KEY (hype_store_id) REFERENCES hype_stores(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key for wallet_transactions';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key for wallet_transactions already exists';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Data recovery completed!';
    RAISE NOTICE 'Recovered 2 hype store records with placeholder data';
    RAISE NOTICE 'Added all missing foreign key constraints';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Please update store details with correct brand information!';
    RAISE NOTICE 'The stores were created with placeholder data.';
END $$;
