-- Migration: Update Hype Store Wallet to Brand Level
-- Date: 2026-03-06
-- Description: Refactors wallet from store-level to brand-level, allowing multiple stores per brand

-- =====================================================
-- 1. REMOVE UNIQUE CONSTRAINT ON brand_id IN hype_store
-- =====================================================
-- Allow multiple stores per brand
ALTER TABLE hype_store DROP CONSTRAINT IF EXISTS hype_store_brand_id_key;

-- =====================================================
-- 2. UPDATE hype_store_wallet TO USE brand_id
-- =====================================================
-- First, check if there are any existing wallets
DO $$
BEGIN
    -- Add brand_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'hype_store_wallet'
                   AND column_name = 'brand_id') THEN

        -- Add brand_id column
        ALTER TABLE hype_store_wallet ADD COLUMN brand_id INTEGER;

        -- Populate brand_id from store_id via hype_store table
        UPDATE hype_store_wallet w
        SET brand_id = s.brand_id
        FROM hype_store s
        WHERE w.store_id = s.id;

        -- Make brand_id NOT NULL after populating
        ALTER TABLE hype_store_wallet ALTER COLUMN brand_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE hype_store_wallet
        ADD CONSTRAINT fk_hype_store_wallet_brand
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

        -- Add unique constraint on brand_id (one wallet per brand)
        ALTER TABLE hype_store_wallet
        ADD CONSTRAINT hype_store_wallet_brand_id_unique
        UNIQUE (brand_id);

        -- Drop old unique constraint on store_id
        ALTER TABLE hype_store_wallet DROP CONSTRAINT IF EXISTS hype_store_wallet_store_id_key;

        -- Drop old foreign key constraint on store_id
        ALTER TABLE hype_store_wallet DROP CONSTRAINT IF EXISTS hype_store_wallet_store_id_fkey;

        -- Drop store_id column
        ALTER TABLE hype_store_wallet DROP COLUMN IF EXISTS store_id;

        -- Drop old index
        DROP INDEX IF EXISTS idx_hype_store_wallet_store_id;

        -- Create new index on brand_id
        CREATE INDEX IF NOT EXISTS idx_hype_store_wallet_brand_id ON hype_store_wallet(brand_id);
    END IF;
END $$;

-- =====================================================
-- 3. UPDATE hype_store_wallet_transactions
-- =====================================================
-- Make store_id nullable (transactions can be brand-level)
ALTER TABLE hype_store_wallet_transactions ALTER COLUMN store_id DROP NOT NULL;

-- Update comment
COMMENT ON COLUMN hype_store_wallet_transactions.store_id IS 'Optional: Store ID if transaction is store-specific, NULL for brand-level transactions like ADD_MONEY';

-- =====================================================
-- 4. UPDATE MINIMUM CASHBACK DEFAULTS
-- =====================================================
-- Update default values for minimum cashback to 100
ALTER TABLE hype_store_cashback_config
ALTER COLUMN reel_post_min_cashback SET DEFAULT 100;

ALTER TABLE hype_store_cashback_config
ALTER COLUMN story_min_cashback SET DEFAULT 100;

-- Update existing records with old default values
UPDATE hype_store_cashback_config
SET reel_post_min_cashback = 100
WHERE reel_post_min_cashback = 2000;

UPDATE hype_store_cashback_config
SET story_min_cashback = 100
WHERE story_min_cashback = 2000;

-- =====================================================
-- 5. UPDATE COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE hype_store IS 'Stores can have multiple per brand now (Store 1, Store 2, etc.)';
COMMENT ON TABLE hype_store_wallet IS 'One wallet per brand, shared across all their stores';
COMMENT ON COLUMN hype_store_wallet.brand_id IS 'Foreign key to brands table - one wallet per brand';
COMMENT ON COLUMN hype_store_cashback_config.reel_post_min_cashback IS 'Minimum cashback for reel/post - fixed at Rs 100';
COMMENT ON COLUMN hype_store_cashback_config.story_min_cashback IS 'Minimum cashback for story - fixed at Rs 100';

-- =====================================================
-- 6. VERIFY MIGRATION SUCCESS
-- =====================================================
DO $$
DECLARE
    wallet_count INTEGER;
    store_count INTEGER;
BEGIN
    -- Check wallet structure
    SELECT COUNT(*) INTO wallet_count
    FROM information_schema.columns
    WHERE table_name = 'hype_store_wallet'
    AND column_name = 'brand_id';

    IF wallet_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: brand_id column not found in hype_store_wallet';
    END IF;

    -- Check store unique constraint removed
    SELECT COUNT(*) INTO store_count
    FROM information_schema.table_constraints
    WHERE table_name = 'hype_store'
    AND constraint_name = 'hype_store_brand_id_key';

    IF store_count > 0 THEN
        RAISE WARNING 'Unique constraint on brand_id still exists in hype_store';
    END IF;

    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '- Wallet is now brand-level';
    RAISE NOTICE '- Multiple stores per brand enabled';
    RAISE NOTICE '- Minimum cashback updated to Rs 100';
END $$;
