-- Move creator preferences from store-level to brand-level

-- 1) Add brand_id column
ALTER TABLE hype_store_creator_preferences
ADD COLUMN IF NOT EXISTS brand_id INTEGER;

-- 2) Backfill brand_id using existing hype_store_id relationship
UPDATE hype_store_creator_preferences hscp
SET brand_id = hs.brand_id
FROM hype_stores hs
WHERE hscp.hype_store_id = hs.id
  AND hscp.brand_id IS NULL;

-- 3) Allow hype_store_id to be nullable (no longer required at brand level)
ALTER TABLE hype_store_creator_preferences
ALTER COLUMN hype_store_id DROP NOT NULL;

-- 4) Drop uniqueness on hype_store_id (will be brand-level unique)
ALTER TABLE hype_store_creator_preferences
DROP CONSTRAINT IF EXISTS hype_store_creator_preferences_hype_store_id_key;

-- 5) Remove duplicate rows per brand, keep the first (lowest id)
DELETE FROM hype_store_creator_preferences hscp
USING (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY brand_id ORDER BY id) AS rn
  FROM hype_store_creator_preferences
) dup
WHERE hscp.id = dup.id
  AND dup.rn > 1;

-- 6) Enforce brand_id presence and uniqueness
ALTER TABLE hype_store_creator_preferences
ALTER COLUMN brand_id SET NOT NULL;

-- Drop existing foreign key constraint if exists, then add it
ALTER TABLE hype_store_creator_preferences
DROP CONSTRAINT IF EXISTS hype_store_creator_preferences_brand_id_fkey;

ALTER TABLE hype_store_creator_preferences
ADD CONSTRAINT hype_store_creator_preferences_brand_id_fkey
FOREIGN KEY (brand_id) REFERENCES brands(id);

-- Drop existing unique constraint if exists, then add it
ALTER TABLE hype_store_creator_preferences
DROP CONSTRAINT IF EXISTS hype_store_creator_preferences_brand_id_key;

ALTER TABLE hype_store_creator_preferences
ADD CONSTRAINT hype_store_creator_preferences_brand_id_key
UNIQUE (brand_id);
