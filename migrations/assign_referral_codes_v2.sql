-- =====================================================================
-- Assign unique 8-character referral codes to all existing influencers
-- This matches the exact format used in auth.service.ts signup logic
-- Format: 8 random uppercase alphanumeric characters (A-Z, 0-9)
-- Example: A7K9M2X8, B3P5L8Q2, etc.
-- =====================================================================

-- Create a function to generate random 8-character codes
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(characters, floor(random() * length(characters) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update influencers without referral codes
DO $$
DECLARE
  influencer_record RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR influencer_record IN
    SELECT id FROM influencers
    WHERE "referralCode" IS NULL
      AND "deletedAt" IS NULL
  LOOP
    -- Generate unique code for each influencer
    LOOP
      new_code := generate_referral_code();

      -- Check if code already exists
      SELECT EXISTS(
        SELECT 1 FROM influencers WHERE "referralCode" = new_code
      ) INTO code_exists;

      EXIT WHEN NOT code_exists;
    END LOOP;

    -- Update influencer with unique code
    UPDATE influencers
    SET "referralCode" = new_code
    WHERE id = influencer_record.id;

    RAISE NOTICE 'Assigned code % to influencer ID %', new_code, influencer_record.id;
  END LOOP;
END $$;

-- Verify the update
SELECT
  id,
  email,
  "referralCode",
  "createdAt",
  LENGTH("referralCode") as code_length
FROM influencers
WHERE "referralCode" IS NOT NULL
  AND "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 20;

-- Count total influencers with referral codes
SELECT
  COUNT(*) as total_influencers,
  COUNT("referralCode") as with_referral_codes,
  COUNT(*) - COUNT("referralCode") as without_referral_codes
FROM influencers
WHERE "deletedAt" IS NULL;

-- Clean up function (optional - uncomment if you want to remove the function after use)
-- DROP FUNCTION IF EXISTS generate_referral_code();
