-- Migration: Add RBAC columns to admins table
-- Date: 2026-04-06
-- Description: Adds custom_permissions and created_by columns, and new admin roles

-- Step 1: Add new roles to the enum type
ALTER TYPE "enum_admins_role"
  ADD VALUE IF NOT EXISTS 'admin'
  BEFORE 'profile_reviewer';

ALTER TYPE "enum_admins_role"
  ADD VALUE IF NOT EXISTS 'support_agent'
  AFTER 'content_moderator';

ALTER TYPE "enum_admins_role"
  ADD VALUE IF NOT EXISTS 'analyst'
  AFTER 'support_agent';

-- Step 2: Rename permissions column to custom_permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'admins' AND column_name = 'permissions') THEN
    ALTER TABLE admins RENAME COLUMN permissions TO custom_permissions;
  END IF;
END $$;

-- Step 3: Add custom_permissions column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'admins' AND column_name = 'custom_permissions') THEN
    ALTER TABLE admins ADD COLUMN custom_permissions JSONB;
    COMMENT ON COLUMN admins.custom_permissions IS 'Custom permissions array - overrides role-based permissions if set';
  END IF;
END $$;

-- Step 4: Add created_by column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'admins' AND column_name = 'created_by') THEN
    ALTER TABLE admins ADD COLUMN created_by INTEGER;
    COMMENT ON COLUMN admins.created_by IS 'Admin who created this account';
  END IF;
END $$;

-- Step 5: Add foreign key constraint on created_by
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'admins_created_by_fkey') THEN
    ALTER TABLE admins
      ADD CONSTRAINT admins_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES admins(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Step 6: Create index on role for faster filtering
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- Step 7: Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);

-- Step 8: Create index on created_by
CREATE INDEX IF NOT EXISTS idx_admins_created_by ON admins(created_by);

-- Verification
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'admins'
  AND column_name IN ('custom_permissions', 'created_by', 'role', 'status')
ORDER BY column_name;
