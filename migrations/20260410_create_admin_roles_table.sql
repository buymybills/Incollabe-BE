-- Migration: Create admin_roles table for CRUD role management
-- Date: 2026-04-10

CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  tab_permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON admin_roles(name);
CREATE INDEX IF NOT EXISTS idx_admin_roles_system ON admin_roles(is_system_role);

-- Seed system roles
INSERT INTO admin_roles (name, label, description, tab_permissions, is_system_role)
VALUES
  (
    'super_admin',
    'Super Admin',
    'Full system access — only one allowed',
    '{"dashboard":"edit","influencers":"edit","brands":"edit","campaigns":"edit","posts":"edit","hype_store":"edit","wallet":"edit","push_notifications":"edit","fiam_campaigns":"edit","profile_reviews":"edit","analytics":"edit","settings":"edit","admin_management":"edit"}',
    true
  ),
  (
    'admin',
    'Admin',
    'Can create accounts and has edit access to most tabs',
    '{"dashboard":"edit","influencers":"edit","brands":"edit","campaigns":"edit","posts":"edit","hype_store":"edit","wallet":"edit","push_notifications":"edit","fiam_campaigns":"edit","profile_reviews":"edit","analytics":"edit","settings":"view","admin_management":"edit"}',
    true
  )
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE admin_roles IS 'Stores named roles with their default tab permission sets';
COMMENT ON COLUMN admin_roles.is_system_role IS 'System roles (super_admin, admin) cannot be deleted or renamed';
COMMENT ON COLUMN admin_roles.tab_permissions IS 'Default tab permissions assigned to admins with this role when no custom tabPermissions are set';
