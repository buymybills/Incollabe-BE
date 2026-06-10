-- Hosted-checkout tables for the Instagram shopping bot.
-- Run manually (the restored DB runs with DB_SYNC=false):
--   docker exec -i postgres psql -U postgres -d incollab_db -f - < create_bot_checkout.sql

CREATE TABLE IF NOT EXISTS bot_customers (
  id          SERIAL PRIMARY KEY,
  brand       VARCHAR(60)  NOT NULL DEFAULT 'thesouledstore',
  igsid       VARCHAR(64)  NOT NULL,
  user_key    VARCHAR(64),
  username    VARCHAR(120),
  name        VARCHAR(120),
  email       VARCHAR(150),
  mobile      VARCHAR(20),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_customers_brand_igsid ON bot_customers (brand, igsid);
CREATE INDEX IF NOT EXISTS idx_bot_customers_user_key    ON bot_customers (user_key);

CREATE TABLE IF NOT EXISTS bot_addresses (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES bot_customers(id),
  label       VARCHAR(40),
  name        VARCHAR(120),
  mobile      VARCHAR(20),
  line1       VARCHAR(200) NOT NULL,
  line2       VARCHAR(200),
  city        VARCHAR(80)  NOT NULL,
  state       VARCHAR(80)  NOT NULL,
  pincode     VARCHAR(12)  NOT NULL,
  country     VARCHAR(60)  NOT NULL DEFAULT 'India',
  is_default  BOOLEAN      NOT NULL DEFAULT false,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_addresses_customer ON bot_addresses (customer_id);

CREATE TABLE IF NOT EXISTS bot_orders (
  id                  SERIAL PRIMARY KEY,
  brand               VARCHAR(60) NOT NULL DEFAULT 'thesouledstore',
  customer_id         INTEGER REFERENCES bot_customers(id),
  igsid               VARCHAR(64),
  username            VARCHAR(120),
  product_slug        VARCHAR(180),
  product_title       VARCHAR(200),
  size                VARCHAR(20),
  qty                 INTEGER NOT NULL DEFAULT 1,
  gender              VARCHAR(20),
  amount_inr          REAL    NOT NULL,
  razorpay_order_id   VARCHAR(60),
  razorpay_payment_id VARCHAR(60),
  razorpay_signature  VARCHAR(180),
  method              VARCHAR(30),
  status              VARCHAR(20) NOT NULL DEFAULT 'created',
  shipping_address    JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_orders_brand_created ON bot_orders (brand, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_orders_customer      ON bot_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_bot_orders_igsid         ON bot_orders (igsid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_orders_rzp_payment ON bot_orders (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
