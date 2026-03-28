-- Add installationId column to device_tokens table (camelCase to match existing columns)
-- This field stores a unique identifier for each app installation instance
-- Useful for tracking specific app installations across devices

ALTER TABLE device_tokens
ADD COLUMN IF NOT EXISTS "installationId" VARCHAR(255);

-- Create an index on installationId for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_installation_id
ON device_tokens("installationId");

-- Add comment to column
COMMENT ON COLUMN device_tokens."installationId" IS 'Unique identifier for each app installation instance';
