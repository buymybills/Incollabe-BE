-- Share codes for saved-items lists (the Instagram bot's "share my code" feature).
-- A shopper claims a short code (e.g. "collabneha"); a friend who types it sees the
-- owner's saved list. One code per shopper, and codes are globally unique.

CREATE TABLE IF NOT EXISTS bot_share_codes (
  id         SERIAL PRIMARY KEY,
  igsid      VARCHAR(64) NOT NULL,
  code       VARCHAR(30) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One code per shopper; no two shoppers share a code (race-free uniqueness — the
-- service's pre-check is backed by these constraints).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_share_codes_igsid ON bot_share_codes(igsid);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_share_codes_code  ON bot_share_codes(code);
