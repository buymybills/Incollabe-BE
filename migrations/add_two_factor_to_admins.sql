-- Migration: Add Two-Factor Authentication column to admins table
-- Date: 2025-01-06
-- Description: Adds twoFactorEnabled boolean column to support 2FA toggle functionality

-- Add the twoFactorEnabled column with default value of false
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries filtering by 2FA status
CREATE INDEX IF NOT EXISTS idx_admins_two_factor_enabled 
ON admins ("twoFactorEnabled");

-- Add comment to document the column
COMMENT ON COLUMN admins."twoFactorEnabled" IS 'Indicates whether two-factor authentication is enabled for this admin account';
