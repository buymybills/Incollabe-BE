-- Check what columns exist in hype_store_orders table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hype_store_orders'
ORDER BY ordinal_position;
