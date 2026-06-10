-- Contract Templates Table
-- Stores editable contract template bodies per contract type.
-- Admin can update the body text via API. Each update creates a new version.
-- Only one template per type is active at a time.

CREATE TABLE IF NOT EXISTS contract_templates (
  id               SERIAL PRIMARY KEY,
  contract_type    VARCHAR(30)   NOT NULL CHECK (contract_type IN ('platform_brand', 'platform_influencer', 'brand_influencer')),
  version          VARCHAR(10)   NOT NULL DEFAULT '1.0',
  body             TEXT          NOT NULL,  -- Template text with {{placeholder}} tokens
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  updated_by       INTEGER,                -- admin ID who last edited
  notes            TEXT,                   -- optional change note from admin
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contract_templates_type_active ON contract_templates(contract_type, is_active);

-- Add contract_text column to contracts to snapshot the rendered text at signing time
-- (so the stored hash remains valid even if the template is later edited)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_text TEXT;
