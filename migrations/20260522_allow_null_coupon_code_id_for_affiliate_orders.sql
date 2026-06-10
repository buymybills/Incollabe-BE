-- Allow coupon_code_id to be NULL for affiliate orders
-- Affiliate link orders don't use coupon codes — they track via referral code in the URL.
-- Previously this column was NOT NULL, blocking order creation for affiliate purchases.

ALTER TABLE hype_store_orders
ALTER COLUMN coupon_code_id DROP NOT NULL;
