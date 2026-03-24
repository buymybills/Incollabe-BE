-- Migration: Fix messageType constraint to include all message types (video, audio, media)
-- This fixes the error: new row for relation "messages" violates check constraint "messages_messageType_check"
-- Run this on PRODUCTION/STAGING database

-- Step 1: Drop ALL existing messageType check constraints
-- (There might be multiple constraints with different cases)
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'messages'::regclass
        AND conname ILIKE '%messagetype%'
    LOOP
        EXECUTE format('ALTER TABLE messages DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Step 2: Add the new constraint with ALL message types
ALTER TABLE messages
  ADD CONSTRAINT messages_messageType_check
    CHECK ("messageType" IN ('text', 'image', 'video', 'audio', 'file', 'media'));

-- Step 3: Verify the constraint was added correctly
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'messages'::regclass
AND conname ILIKE '%messagetype%';

-- Step 4: Test that all message types are now allowed
-- (This will show you what values are valid)
COMMENT ON COLUMN messages."messageType" IS 'Message type: text, image, video, audio, file, or media (for multiple attachments). Updated to support all types.';
