-- Add missing locked cashback reference column to hype_store_orders
ALTER TABLE hype_store_orders
ADD COLUMN IF NOT EXISTS locked_cashback_transaction_id INTEGER;
