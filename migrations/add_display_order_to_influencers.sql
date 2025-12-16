-- Add display_order column to influencers table for manual ordering
-- Lower numbers appear first (1, 2, 3...). NULL values appear last.

ALTER TABLE influencers 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_influencers_display_order 
ON influencers(display_order) 
WHERE display_order IS NOT NULL;

-- Add comment
COMMENT ON COLUMN influencers.display_order IS 'Manual ordering position set by admin. Lower numbers appear first. NULL values use default sort (createdAt).';

-- Optional: Set initial order based on current createdAt for existing records
-- This preserves current order but allows future manual changes
-- UPDATE influencers 
-- SET display_order = subquery.row_num
-- FROM (
--   SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
--   FROM influencers
--   WHERE is_active = TRUE
-- ) AS subquery
-- WHERE influencers.id = subquery.id;
