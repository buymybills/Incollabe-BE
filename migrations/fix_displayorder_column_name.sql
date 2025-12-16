-- Fix: Rename displayorder to match Sequelize camelCase convention
-- Sequelize converts displayOrder to display_order by default

-- For brands table
ALTER TABLE brands
  RENAME COLUMN displayorder TO "displayOrder";

-- For influencers table (if it exists)
ALTER TABLE influencers
  RENAME COLUMN displayorder TO "displayOrder";

-- Add comments for documentation
COMMENT ON COLUMN brands."displayOrder" IS 'Display order for sorting brands in admin panel';
COMMENT ON COLUMN influencers."displayOrder" IS 'Display order for sorting influencers in admin panel';
