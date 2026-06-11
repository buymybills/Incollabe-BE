-- Outbound order forwarding ("revert the order to the brand") status on bot_orders.
-- Run on each environment:
--   docker exec -i postgres psql -U postgres -d incollab_db -f - < add_fulfillment_to_bot_orders.sql

ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS fulfillment_status   VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS fulfillment_ref      VARCHAR(120);
ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS fulfillment_error    VARCHAR(400);
ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS fulfillment_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bot_orders_fulfillment ON bot_orders (brand, fulfillment_status);
