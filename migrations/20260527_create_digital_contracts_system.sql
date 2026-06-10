-- Digital Contract System Migration
-- Creates tables for: user_signatures, contracts, contract_signatories, contract_audit_logs

-- ============================================================
-- 1. USER SIGNATURES
-- Each brand/influencer draws their signature once during onboarding
-- ============================================================
CREATE TABLE IF NOT EXISTS user_signatures (
  id               SERIAL PRIMARY KEY,
  user_type        VARCHAR(20)  NOT NULL CHECK (user_type IN ('brand', 'influencer')),
  user_id          INTEGER      NOT NULL,
  signature_url    TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_type, user_id)
);

-- ============================================================
-- 2. CONTRACTS
-- Master record for every agreement on the platform
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id                       SERIAL PRIMARY KEY,
  contract_number          VARCHAR(50)  UNIQUE NOT NULL,           -- e.g. CTR-2026-4821
  contract_type            VARCHAR(30)  NOT NULL CHECK (contract_type IN ('platform_brand', 'platform_influencer', 'brand_influencer')),
  status                   VARCHAR(30)  NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'partially_signed', 'fully_signed', 'breached', 'void')),
  template_version         VARCHAR(10)  NOT NULL DEFAULT '1.0',
  contract_data            JSONB        NOT NULL,                  -- all filled-in variables (names, amounts, deadlines)
  content_hash             VARCHAR(64),                            -- SHA-256 of the rendered contract text
  pdf_url                  TEXT,                                   -- S3 URL of the final signed PDF
  campaign_application_id  INTEGER,                               -- FK to campaign_applications (brand_influencer only)
  brand_id                 INTEGER,
  influencer_id            INTEGER,
  signing_deadline         TIMESTAMPTZ,
  breach_details           JSONB,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_brand_id       ON contracts(brand_id);
CREATE INDEX idx_contracts_influencer_id  ON contracts(influencer_id);
CREATE INDEX idx_contracts_status         ON contracts(status);
CREATE INDEX idx_contracts_type           ON contracts(contract_type);
CREATE INDEX idx_contracts_app_id         ON contracts(campaign_application_id);

-- ============================================================
-- 3. CONTRACT SIGNATORIES
-- One row per party required to sign a given contract
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_signatories (
  id                  SERIAL PRIMARY KEY,
  contract_id         INTEGER      NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  party_type          VARCHAR(20)  NOT NULL CHECK (party_type IN ('brand', 'influencer', 'platform')),
  party_id            INTEGER,                                    -- null for platform (Collabkaroo itself)
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'signed')),
  signed_at           TIMESTAMPTZ,
  ip_address          VARCHAR(45),
  device_info         TEXT,
  scrolled_to_bottom  BOOLEAN      NOT NULL DEFAULT FALSE,
  scrolled_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signatories_contract_id  ON contract_signatories(contract_id);
CREATE INDEX idx_signatories_party        ON contract_signatories(party_type, party_id);

-- ============================================================
-- 4. CONTRACT AUDIT LOGS
-- Every action against a contract — used for evidence bundles
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_audit_logs (
  id           SERIAL PRIMARY KEY,
  contract_id  INTEGER      NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  action       VARCHAR(60)  NOT NULL,   -- e.g. contract_created, viewed, scrolled_to_bottom, signed, pdf_generated, breach_flagged
  actor_type   VARCHAR(20)  NOT NULL,   -- brand | influencer | platform | system
  actor_id     INTEGER,
  metadata     JSONB,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_contract_id  ON contract_audit_logs(contract_id);
CREATE INDEX idx_audit_logs_action       ON contract_audit_logs(action);
