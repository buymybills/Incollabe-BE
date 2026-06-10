-- Migration: Add product detail fields to hype_store_orders table
-- Date: 2026-03-17
-- Description: Add dedicated product detail fields (SKU, category, brand, variant, image, quantity)
--              to support comprehensive product tracking in purchase webhooks

BEGIN;

-- Add product SKU/Item Code
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS product_sku VARCHAR(255) NULL;

COMMENT ON COLUMN hype_store_orders.product_sku IS 'Product SKU/Item Code';

-- Add product category
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS product_category VARCHAR(255) NULL;

COMMENT ON COLUMN hype_store_orders.product_category IS 'Product category (e.g., Electronics, Clothing, etc.)';

-- Add product brand name
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS product_brand VARCHAR(255) NULL;

COMMENT ON COLUMN hype_store_orders.product_brand IS 'Product brand name';

-- Add product variant (size, color, etc.)
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS product_variant VARCHAR(255) NULL;

COMMENT ON COLUMN hype_store_orders.product_variant IS 'Product variant (e.g., size, color, etc.)';

-- Add product image URL
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS product_image_url VARCHAR(500) NULL;

COMMENT ON COLUMN hype_store_orders.product_image_url IS 'Product image URL';

-- Add product quantity
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS product_quantity INTEGER DEFAULT 1;

COMMENT ON COLUMN hype_store_orders.product_quantity IS 'Product quantity';

COMMIT;

-- Verification query
SELECT
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hype_store_orders'
AND column_name IN (
    'product_sku',
    'product_category',
    'product_brand',
    'product_variant',
    'product_image_url',
    'product_quantity'
)
ORDER BY ordinal_position;
