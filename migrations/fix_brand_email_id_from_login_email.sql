-- Migration: Set brandEmailId to decrypted login email for brands where brandEmailId is null
-- This fixes existing brands that signed up before the auto-population fix was implemented
--
-- IMPORTANT: Run this migration BEFORE deploying the code fix to ensure data consistency

-- First, let's check how many brands need to be fixed
SELECT
    COUNT(*) as brands_with_null_brand_email,
    (SELECT COUNT(*) FROM brands WHERE "brandEmailId" IS NOT NULL) as brands_with_brand_email,
    (SELECT COUNT(*) FROM brands) as total_brands
FROM brands
WHERE "brandEmailId" IS NULL;

-- Preview what will be updated (uncomment to see before running the update)
-- NOTE: email field is encrypted in the database, so this query will show encrypted values
-- The application will decrypt them when reading
/*
SELECT
    id,
    "brandName",
    email as encrypted_login_email,
    "brandEmailId" as current_brand_email_id,
    'will be updated' as action
FROM brands
WHERE "brandEmailId" IS NULL
  AND email IS NOT NULL
LIMIT 10;
*/

-- CRITICAL NOTE:
-- The 'email' column is ENCRYPTED in the database using the EncryptionService
-- We CANNOT directly copy encrypted email to brandEmailId because:
-- 1. email is encrypted (format: "encrypted:iv:data")
-- 2. brandEmailId should be stored as PLAIN TEXT (no encryption hook exists for it)
--
-- SOLUTION: This migration should be done via the backend API or NestJS script
-- that can properly decrypt the email before setting brandEmailId

-- DO NOT RUN THIS SQL DIRECTLY - it will copy encrypted data to brandEmailId
-- UPDATE brands
-- SET "brandEmailId" = email
-- WHERE "brandEmailId" IS NULL
--   AND email IS NOT NULL;

-- Instead, use one of these approaches:

-- OPTION 1: Update via API (Recommended for small datasets)
-- Use the brand update profile API to set brandEmailId for each brand

-- OPTION 2: Create a NestJS migration script (Recommended for production)
-- Create a script in src/scripts/fix-brand-email-ids.ts that:
-- 1. Fetches all brands with null brandEmailId
-- 2. For each brand, decrypt the email (automatically done by afterFind hook)
-- 3. Set brandEmailId = email
-- 4. Save the brand (brandEmailId stays plain text, email stays encrypted)

-- OPTION 3: Manual SQL with decryption (Advanced - requires encryption keys)
-- If you have access to the encryption keys, you can decrypt in SQL, but this is not recommended

-- Verification query (run after fix is applied):
SELECT
    COUNT(*) as brands_with_brand_email_id_set,
    (SELECT COUNT(*) FROM brands WHERE "brandEmailId" IS NULL) as brands_with_null_brand_email_id
FROM brands
WHERE "brandEmailId" IS NOT NULL;
