-- Create device_tokens table to support multiple devices per user
-- Allows up to 5 devices per user with automatic cleanup of oldest tokens

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,

  -- User identification
  "userId" INTEGER NOT NULL,
  "userType" VARCHAR(20) NOT NULL CHECK ("userType" IN ('influencer', 'brand', 'admin')),

  -- Device information
  "fcmToken" VARCHAR(500) NOT NULL UNIQUE,
  "deviceId" VARCHAR(255), -- Optional: device identifier from app
  "deviceName" VARCHAR(100), -- e.g., "iPhone 13 Pro", "Samsung Galaxy S21"
  "deviceOs" VARCHAR(20), -- 'ios' or 'android'
  "appVersion" VARCHAR(20), -- e.g., "1.2.3"

  -- Metadata
  "lastUsedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_lookup ON device_tokens("userId", "userType");
CREATE INDEX IF NOT EXISTS idx_device_tokens_fcm_token ON device_tokens("fcmToken");
CREATE INDEX IF NOT EXISTS idx_device_tokens_last_used ON device_tokens("lastUsedAt" DESC);

-- Comments for documentation
COMMENT ON TABLE device_tokens IS 'Stores FCM tokens for multiple devices per user (max 5 devices)';
COMMENT ON COLUMN device_tokens."userId" IS 'ID of influencer, brand, or admin';
COMMENT ON COLUMN device_tokens."userType" IS 'Type of user: influencer, brand, or admin';
COMMENT ON COLUMN device_tokens."fcmToken" IS 'Firebase Cloud Messaging token (unique across all users)';
COMMENT ON COLUMN device_tokens."deviceId" IS 'Unique device identifier from mobile app';
COMMENT ON COLUMN device_tokens."deviceName" IS 'Human-readable device name (e.g., iPhone 13 Pro)';
COMMENT ON COLUMN device_tokens."deviceOs" IS 'Device operating system (ios or android)';
COMMENT ON COLUMN device_tokens."appVersion" IS 'App version number (e.g., 1.2.3)';
COMMENT ON COLUMN device_tokens."lastUsedAt" IS 'Last time this device was active (used for cleanup)';
