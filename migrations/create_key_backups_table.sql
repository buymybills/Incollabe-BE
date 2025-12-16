-- Migration: Create key_backups table for password-encrypted private key storage
-- This enables cross-device E2EE while keeping the server unable to decrypt

CREATE TABLE key_backups (
  id SERIAL PRIMARY KEY,

  -- User identification
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('influencer', 'brand')),
  user_id INTEGER NOT NULL,

  -- Encrypted private key (encrypted with password-derived key on client)
  encrypted_private_key TEXT NOT NULL,

  -- Salt used for PBKDF2 key derivation (stored in hex format)
  salt VARCHAR(64) NOT NULL,

  -- Public key (for verification)
  public_key TEXT NOT NULL,

  -- Metadata
  key_version INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  device_info JSONB, -- Optional: track which devices have accessed

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint: one backup per user
  UNIQUE(user_type, user_id)
);

-- Indexes
CREATE INDEX idx_key_backups_user ON key_backups(user_type, user_id);
CREATE INDEX idx_key_backups_created_at ON key_backups(created_at);

-- Comments
COMMENT ON TABLE key_backups IS 'Stores password-encrypted private keys for E2EE cross-device support';
COMMENT ON COLUMN key_backups.encrypted_private_key IS 'Private key encrypted with PBKDF2-derived key from user password';
COMMENT ON COLUMN key_backups.salt IS 'Random salt for PBKDF2 key derivation (hex string)';
COMMENT ON COLUMN key_backups.public_key IS 'Corresponding public key for verification';
COMMENT ON COLUMN key_backups.key_version IS 'Version number for key rotation support';
