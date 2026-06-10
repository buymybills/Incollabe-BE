-- Migration: Convert to Tab-Based RBAC System
-- Date: 2026-04-07
-- Description: Converts role-based permissions to tab-based permissions system with flexible role names

-- Step 1: Create backup of current admins table structure
DO $$
BEGIN
  -- Log current state
  RAISE NOTICE 'Starting migration to tab-based RBAC system';
END $$;

-- Step 2: Change role column from ENUM to VARCHAR to support custom role names
-- First, we need to alter the column type
DO $$
BEGIN
  -- Check if role column is ENUM type
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admins'
      AND column_name = 'role'
      AND udt_name = 'enum_admins_role'
  ) THEN
    -- Convert ENUM to VARCHAR
    ALTER TABLE admins
      ALTER COLUMN role TYPE VARCHAR(50) USING role::text;

    RAISE NOTICE 'Converted role column from ENUM to VARCHAR';
  ELSE
    RAISE NOTICE 'Role column already VARCHAR';
  END IF;
END $$;

-- Step 3: Rename custom_permissions column to tab_permissions (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admins'
      AND column_name = 'custom_permissions'
  ) THEN
    ALTER TABLE admins RENAME COLUMN custom_permissions TO tab_permissions;

    -- Update comment
    COMMENT ON COLUMN admins.tab_permissions IS 'Tab-based permissions: { "dashboard": "edit", "students": "view", "campaigns": "none" }';

    RAISE NOTICE 'Renamed custom_permissions to tab_permissions';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admins'
      AND column_name = 'permissions'
  ) THEN
    -- Rename from old permissions column
    ALTER TABLE admins RENAME COLUMN permissions TO tab_permissions;

    -- Update comment
    COMMENT ON COLUMN admins.tab_permissions IS 'Tab-based permissions: { "dashboard": "edit", "students": "view", "campaigns": "none" }';

    RAISE NOTICE 'Renamed permissions to tab_permissions';
  ELSE
    -- Create tab_permissions column if it doesn't exist
    ALTER TABLE admins ADD COLUMN tab_permissions JSONB;
    COMMENT ON COLUMN admins.tab_permissions IS 'Tab-based permissions: { "dashboard": "edit", "students": "view", "campaigns": "none" }';

    RAISE NOTICE 'Created tab_permissions column';
  END IF;
END $$;

-- Step 4: Ensure created_by column exists with correct type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admins'
      AND column_name = 'created_by'
  ) THEN
    -- Create created_by column
    ALTER TABLE admins ADD COLUMN created_by INTEGER;
    COMMENT ON COLUMN admins.created_by IS 'Admin who created this account';

    -- Add foreign key constraint
    ALTER TABLE admins
      ADD CONSTRAINT admins_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES admins(id)
      ON DELETE SET NULL;

    RAISE NOTICE 'Created created_by column with foreign key';
  ELSE
    -- Check if column type is correct
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'admins'
        AND column_name = 'created_by'
        AND data_type != 'integer'
    ) THEN
      -- Drop foreign key if exists
      ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_created_by_fkey;

      -- Change column type
      ALTER TABLE admins
        ALTER COLUMN created_by TYPE INTEGER USING created_by::integer;

      -- Re-add foreign key
      ALTER TABLE admins
        ADD CONSTRAINT admins_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES admins(id)
        ON DELETE SET NULL;

      RAISE NOTICE 'Updated created_by column type to INTEGER';
    END IF;
  END IF;
END $$;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);
CREATE INDEX IF NOT EXISTS idx_admins_created_by ON admins(created_by);

-- Step 6: Clear any existing tab_permissions data (fresh start)
-- This ensures all admins will use their role's default permissions
UPDATE admins SET tab_permissions = NULL;

-- Step 7: Normalize existing role values
-- Convert old enum values to new system (if any old values exist)
UPDATE admins
SET role = 'super_admin'
WHERE role IN ('super_admin', 'SUPER_ADMIN', 'superadmin');

UPDATE admins
SET role = 'admin'
WHERE role IN ('admin', 'ADMIN', 'Admin');

-- Drop old ENUM type if it exists (after converting all columns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_admins_role') THEN
    DROP TYPE IF EXISTS enum_admins_role CASCADE;
    RAISE NOTICE 'Dropped old enum_admins_role type';
  END IF;
END $$;

-- Verification queries
DO $$
DECLARE
  role_type TEXT;
  tab_perms_exists BOOLEAN;
  created_by_type TEXT;
BEGIN
  -- Check role column type
  SELECT data_type INTO role_type
  FROM information_schema.columns
  WHERE table_name = 'admins' AND column_name = 'role';

  -- Check if tab_permissions exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admins' AND column_name = 'tab_permissions'
  ) INTO tab_perms_exists;

  -- Check created_by type
  SELECT data_type INTO created_by_type
  FROM information_schema.columns
  WHERE table_name = 'admins' AND column_name = 'created_by';

  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'role column type: %', role_type;
  RAISE NOTICE 'tab_permissions column exists: %', tab_perms_exists;
  RAISE NOTICE 'created_by column type: %', created_by_type;
  RAISE NOTICE '===========================';
END $$;

-- Display final schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  udt_name
FROM information_schema.columns
WHERE table_name = 'admins'
  AND column_name IN ('role', 'tab_permissions', 'created_by', 'status')
ORDER BY column_name;

-- Display current admin count by role
SELECT
  role,
  COUNT(*) as count
FROM admins
GROUP BY role
ORDER BY count DESC;
