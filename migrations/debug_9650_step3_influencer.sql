-- Step 3: Check influencer's Pro status
SELECT
  id,
  name,
  username,
  "isPro",
  "proActivatedAt",
  "proExpiresAt",
  "createdAt"
FROM influencer
WHERE id = 9650;
