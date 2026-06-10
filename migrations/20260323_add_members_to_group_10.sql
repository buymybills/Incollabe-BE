-- Migration: Add members to group chat ID 10 to reach 100 members
-- Date: 2026-03-23
-- Description: Adds influencer members to group chat 10 until it has 100 total members

-- Step 1: Check current member count for group 10
SELECT
  "groupChatId",
  COUNT(*) as current_member_count
FROM group_members
WHERE "groupChatId" = 10
  AND "leftAt" IS NULL  -- Only count active members
GROUP BY "groupChatId";

-- Step 2: Calculate how many members we need to add (100 - current count)
DO $$
DECLARE
  current_count INTEGER;
  members_to_add INTEGER;
  available_influencers INTEGER;
BEGIN
  -- Get current member count
  SELECT COUNT(*) INTO current_count
  FROM group_members
  WHERE "groupChatId" = 10
    AND "leftAt" IS NULL;

  -- Calculate how many we need to add
  members_to_add := 100 - current_count;

  -- Check if we have enough influencers available
  SELECT COUNT(*) INTO available_influencers
  FROM influencers
  WHERE id NOT IN (
    SELECT "memberId"
    FROM group_members
    WHERE "groupChatId" = 10
      AND "memberType" = 'influencer'
      AND "leftAt" IS NULL
  );

  RAISE NOTICE 'Current members in group 10: %', current_count;
  RAISE NOTICE 'Members needed to reach 100: %', members_to_add;
  RAISE NOTICE 'Available influencers: %', available_influencers;

  -- Only proceed if we need to add members and have enough available
  IF members_to_add > 0 THEN
    IF available_influencers >= members_to_add THEN
      -- Insert new members
      INSERT INTO group_members ("groupChatId", "memberId", "memberType", role, "joinedAt")
      SELECT
        10 as "groupChatId",
        id as "memberId",
        'influencer' as "memberType",
        'member' as role,
        NOW() as "joinedAt"
      FROM influencers
      WHERE id NOT IN (
        SELECT "memberId"
        FROM group_members
        WHERE "groupChatId" = 10
          AND "memberType" = 'influencer'
          AND "leftAt" IS NULL
      )
      ORDER BY id
      LIMIT members_to_add;

      RAISE NOTICE 'Successfully added % members to group 10', members_to_add;
    ELSE
      RAISE WARNING 'Not enough influencers available! Need % but only have %', members_to_add, available_influencers;
    END IF;
  ELSE
    RAISE NOTICE 'Group 10 already has % members (>= 100)', current_count;
  END IF;
END $$;

-- Step 3: Verify final member count
SELECT
  "groupChatId",
  COUNT(*) as final_member_count,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
  COUNT(CASE WHEN role = 'member' THEN 1 END) as member_count,
  COUNT(CASE WHEN "memberType" = 'influencer' THEN 1 END) as influencer_count,
  COUNT(CASE WHEN "memberType" = 'brand' THEN 1 END) as brand_count
FROM group_members
WHERE "groupChatId" = 10
  AND "leftAt" IS NULL
GROUP BY "groupChatId";
