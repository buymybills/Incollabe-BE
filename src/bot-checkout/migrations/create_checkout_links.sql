-- Short id → full signed checkout token mapping, so the link the bot DMs is
-- tiny (/api/checkout/<id>) instead of embedding the whole base64 payload.

CREATE TABLE IF NOT EXISTS checkout_links (
  id         VARCHAR(16) PRIMARY KEY,
  token      TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reuse the same short id when an identical token is shortened again.
CREATE INDEX IF NOT EXISTS idx_checkout_links_token ON checkout_links(token);
