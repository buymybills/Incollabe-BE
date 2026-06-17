-- Bot-managed promo codes for the Instagram shopping checkout (our codes, not the
-- TSS website coupons). Discount is always recomputed server-side.

CREATE TABLE IF NOT EXISTS bot_coupons (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(40)  NOT NULL UNIQUE,
  discount_type   VARCHAR(10)  NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','flat')),
  discount_value  NUMERIC(10,2) NOT NULL,
  max_discount_inr NUMERIC(10,2),
  min_order_inr   NUMERIC(10,2),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  usage_limit     INTEGER,
  used_count      INTEGER      NOT NULL DEFAULT 0,
  valid_from      TIMESTAMP WITH TIME ZONE,
  valid_until     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Record which coupon + discount applied to each bot order.
ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS coupon_code  VARCHAR(40);
ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS discount_inr NUMERIC(10,2) NOT NULL DEFAULT 0;
