-- Bot shopping system: customers, addresses, orders, cart, saved items,
-- share codes, checkout links, coupons, comment automations, and analytics.
-- All statements are idempotent (IF NOT EXISTS).

-- ============================================================
-- bot_events  (Instagram shopping-bot analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_events (
  id            SERIAL PRIMARY KEY,
  brand         VARCHAR(60)   NOT NULL DEFAULT 'thesouledstore',
  source        VARCHAR(20)   NOT NULL DEFAULT 'instagram',
  user_key      VARCHAR(64),
  username      VARCHAR(120),
  session_id    VARCHAR(100),
  event_type    VARCHAR(40)   NOT NULL,
  product_slug  VARCHAR(180),
  product_title VARCHAR(200),
  category      VARCHAR(120),
  gender        VARCHAR(20),
  size          VARCHAR(20),
  price_inr     DOUBLE PRECISION,
  value_inr     DOUBLE PRECISION,
  query         VARCHAR(300),
  faq_category  VARCHAR(60),
  answered      BOOLEAN,
  metadata      JSONB,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_events_brand_type_created ON bot_events (brand, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_events_brand_slug         ON bot_events (brand, product_slug);
CREATE INDEX IF NOT EXISTS idx_bot_events_user_key           ON bot_events (user_key);
CREATE INDEX IF NOT EXISTS idx_bot_events_created_at         ON bot_events (created_at);

-- ============================================================
-- bot_customers  (shoppers identified by Instagram igsid)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_customers (
  id         SERIAL PRIMARY KEY,
  brand      VARCHAR(60)  NOT NULL DEFAULT 'thesouledstore',
  igsid      VARCHAR(64)  NOT NULL,
  user_key   VARCHAR(64),
  username   VARCHAR(120),
  name       VARCHAR(120),
  email      VARCHAR(150),
  mobile     VARCHAR(20),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_customers_brand ON bot_customers (brand);
CREATE INDEX IF NOT EXISTS idx_bot_customers_igsid ON bot_customers (igsid);
CREATE INDEX IF NOT EXISTS idx_bot_customers_ukey  ON bot_customers (user_key);

-- ============================================================
-- bot_addresses  (saved shipping addresses per customer)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_addresses (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER      NOT NULL REFERENCES bot_customers(id) ON DELETE CASCADE,
  label       VARCHAR(40),
  name        VARCHAR(120),
  mobile      VARCHAR(20),
  line1       VARCHAR(200) NOT NULL,
  line2       VARCHAR(200),
  city        VARCHAR(80)  NOT NULL,
  state       VARCHAR(80)  NOT NULL,
  pincode     VARCHAR(12)  NOT NULL,
  country     VARCHAR(60)  NOT NULL DEFAULT 'India',
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_addresses_customer ON bot_addresses (customer_id);

-- ============================================================
-- bot_orders  (placed orders via the hosted checkout page)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_orders (
  id                   SERIAL PRIMARY KEY,
  brand                VARCHAR(60)   NOT NULL DEFAULT 'thesouledstore',
  customer_id          INTEGER       REFERENCES bot_customers(id) ON DELETE SET NULL,
  igsid                VARCHAR(64),
  username             VARCHAR(120),
  product_slug         VARCHAR(180),
  product_title        VARCHAR(200),
  size                 VARCHAR(20),
  qty                  INTEGER       NOT NULL DEFAULT 1,
  gender               VARCHAR(20),
  amount_inr           DECIMAL(10,2) NOT NULL,
  coupon_code          VARCHAR(40),
  discount_inr         DECIMAL(10,2) NOT NULL DEFAULT 0,
  razorpay_order_id    VARCHAR(60),
  razorpay_payment_id  VARCHAR(60),
  razorpay_signature   VARCHAR(180),
  method               VARCHAR(30),
  status               VARCHAR(20)   NOT NULL DEFAULT 'created',
  shipping_address     JSONB,
  fulfillment_status   VARCHAR(20)   NOT NULL DEFAULT 'pending',
  fulfillment_ref      VARCHAR(120),
  fulfillment_error    VARCHAR(400),
  fulfillment_attempts INTEGER       NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_orders_brand         ON bot_orders (brand);
CREATE INDEX IF NOT EXISTS idx_bot_orders_customer      ON bot_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_bot_orders_igsid         ON bot_orders (igsid);
CREATE INDEX IF NOT EXISTS idx_bot_orders_slug          ON bot_orders (product_slug);
CREATE INDEX IF NOT EXISTS idx_bot_orders_rp_order      ON bot_orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_bot_orders_rp_payment    ON bot_orders (razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_bot_orders_status        ON bot_orders (status);
CREATE INDEX IF NOT EXISTS idx_bot_orders_fulfillment   ON bot_orders (fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_bot_orders_created       ON bot_orders (created_at);

-- ============================================================
-- bot_cart_items  (active shopping cart lines per igsid)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_cart_items (
  id          SERIAL PRIMARY KEY,
  igsid       VARCHAR(64)    NOT NULL,
  product_url VARCHAR(1024)  NOT NULL,
  title       VARCHAR(255)   NOT NULL,
  size        VARCHAR(20),
  price_inr   DECIMAL(10,2)  NOT NULL DEFAULT 0,
  image_url   VARCHAR(1024),
  slug        VARCHAR(255),
  qty         INTEGER        NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_cart_items_igsid ON bot_cart_items (igsid);

-- ============================================================
-- bot_saved_items  (wishlist / saved products per igsid)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_saved_items (
  id          SERIAL PRIMARY KEY,
  igsid       VARCHAR(64)    NOT NULL,
  product_url VARCHAR(1024)  NOT NULL,
  title       VARCHAR(255)   NOT NULL,
  image_url   VARCHAR(1024),
  slug        VARCHAR(255),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_saved_items_igsid ON bot_saved_items (igsid);

-- ============================================================
-- bot_share_codes  (one share-code per igsid for saved lists)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_share_codes (
  id         SERIAL PRIMARY KEY,
  igsid      VARCHAR(64)  NOT NULL,
  code       VARCHAR(30)  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_share_codes_igsid ON bot_share_codes (igsid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_share_codes_code  ON bot_share_codes (code);

-- ============================================================
-- checkout_links  (short-id → signed token mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS checkout_links (
  id         VARCHAR(16)  PRIMARY KEY,
  token      TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- bot_coupons  (bot-managed promo codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_coupons (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(40)    NOT NULL,
  discount_type    VARCHAR(10)    NOT NULL DEFAULT 'percent',
  discount_value   DECIMAL(10,2)  NOT NULL,
  max_discount_inr DECIMAL(10,2),
  min_order_inr    DECIMAL(10,2),
  is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
  usage_limit      INTEGER,
  used_count       INTEGER        NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ,
  valid_until      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_coupons_code ON bot_coupons (code);

-- ============================================================
-- comment_automations  (Instagram comment-reply automation rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_automations (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(255)  NOT NULL,
  media_url         TEXT          NOT NULL,
  media_shortcode   VARCHAR(100),
  media_id          VARCHAR(100),
  keyword           VARCHAR(500)  NOT NULL,
  match_type        VARCHAR(20)   NOT NULL DEFAULT 'contains',
  comment_reply     TEXT,
  dm_message        TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  trigger_count     INTEGER       NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_by        INTEGER,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
