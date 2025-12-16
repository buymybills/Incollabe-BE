-- Migration: Add End-to-End Encryption (E2EE) support
-- This enables secure encrypted messaging between users

-- Step 1: Add public key fields to influencers table
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS "publicKey" TEXT,
  ADD COLUMN IF NOT EXISTS "publicKeyCreatedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "publicKeyUpdatedAt" TIMESTAMP WITH TIME ZONE;

-- Step 2: Add public key fields to brands table
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS "publicKey" TEXT,
  ADD COLUMN IF NOT EXISTS "publicKeyCreatedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "publicKeyUpdatedAt" TIMESTAMP WITH TIME ZONE;

-- Step 3: Add encryption metadata to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS "isEncrypted" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "encryptionVersion" VARCHAR(10) DEFAULT 'v1';

-- Step 4: Create indexes for key lookups
CREATE INDEX IF NOT EXISTS idx_influencers_public_key ON influencers("publicKey") WHERE "publicKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_public_key ON brands("publicKey") WHERE "publicKey" IS NOT NULL;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN influencers."publicKey" IS 'RSA public key (PEM format) for E2EE message encryption';
COMMENT ON COLUMN influencers."publicKeyCreatedAt" IS 'Timestamp when the public key was first created';
COMMENT ON COLUMN influencers."publicKeyUpdatedAt" IS 'Timestamp when the public key was last updated';

COMMENT ON COLUMN brands."publicKey" IS 'RSA public key (PEM format) for E2EE message encryption';
COMMENT ON COLUMN brands."publicKeyCreatedAt" IS 'Timestamp when the public key was first created';
COMMENT ON COLUMN brands."publicKeyUpdatedAt" IS 'Timestamp when the public key was last updated';

COMMENT ON COLUMN messages."isEncrypted" IS 'Whether the message content is end-to-end encrypted';
COMMENT ON COLUMN messages."encryptionVersion" IS 'Encryption scheme version (for future compatibility)';

-- Note: Private keys are NEVER stored on the server - they remain on the client only
-- Public keys are stored to enable other users to encrypt messages for this user
