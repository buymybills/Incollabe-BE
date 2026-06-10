-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create shopping_orders table
-- Purpose  : Persist Instagram DM shopping orders (product, customer, address)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE shopping_order_status AS ENUM ('pending', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS shopping_orders (
  id                SERIAL PRIMARY KEY,

  -- Buyer identification
  ig_sender_id      VARCHAR(64)     NOT NULL,       -- Instagram user ID of the buyer

  -- Product
  product_name      VARCHAR(256)    NOT NULL,
  brand_name        VARCHAR(128)    NOT NULL,
  brand_id          INTEGER         REFERENCES brands(id) ON DELETE SET NULL,
  product_url       TEXT,
  size              VARCHAR(32),
  amount_inr        NUMERIC(10, 2)  NOT NULL,

  -- Customer details
  customer_name     VARCHAR(128),
  customer_phone    VARCHAR(20),
  customer_email    VARCHAR(128),

  -- Shipping address
  shipping_line1    VARCHAR(256),
  shipping_line2    VARCHAR(256),
  shipping_city     VARCHAR(128),
  shipping_state    VARCHAR(64),
  shipping_pincode  VARCHAR(16),

  -- Billing address (only populated when different from shipping)
  billing_different BOOLEAN         NOT NULL DEFAULT FALSE,
  billing_line1     VARCHAR(256),
  billing_line2     VARCHAR(256),
  billing_city      VARCHAR(128),
  billing_state     VARCHAR(64),
  billing_pincode   VARCHAR(16),

  -- Payment
  payment_link_id   VARCHAR(128),
  payment_short_url TEXT,
  status            shopping_order_status NOT NULL DEFAULT 'pending',

  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for brand dashboard queries
CREATE INDEX IF NOT EXISTS idx_shopping_orders_brand_id
  ON shopping_orders(brand_id);

-- Index for per-user order history
CREATE INDEX IF NOT EXISTS idx_shopping_orders_ig_sender
  ON shopping_orders(ig_sender_id);

-- Index for Razorpay webhook lookup
CREATE INDEX IF NOT EXISTS idx_shopping_orders_payment_link_id
  ON shopping_orders(payment_link_id);
