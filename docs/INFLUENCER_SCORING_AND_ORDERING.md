# Influencer Scoring and Ordering System

## Overview

This document explains how influencers are scored, ordered, and filtered in the admin dashboard based on different profile types.

---

## Profile Types and Ordering

### **1. TOP_PROFILE (Top Influencers)**

**Ordering:** Sorted by **Overall Score** (highest to lowest)

**Score Calculation:**
The overall score is a weighted average of 6 metrics:

```
Overall Score = (
  nicheMatchScore × 30% +
  engagementRateScore × 25% +
  audienceRelevanceScore × 15% +
  locationMatchScore × 15% +
  pastPerformanceScore × 10% +
  collaborationChargesScore × 5%
) / 100
```

#### Detailed Metrics:

| Metric | Weight | Calculation |
|--------|--------|-------------|
| **Niche Match** | 30% | • No target niches: 70<br>• No match: 30<br>• Perfect match: 100<br>• Partial match: 50 + (matchPercentage / 2) |
| **Engagement Rate** | 25% | • Formula: (avgLikes / followers) × 100<br>• 6%+: 100<br>• 5-6%: 85-100<br>• 4-5%: 75-85<br>• 3-4%: 60-75<br>• 2-3%: 40-60<br>• 1-2%: 20-40<br>• 0-1%: 0-20 |
| **Audience Relevance** | 15% | Based on follower count:<br>• 1M+: 100<br>• 500K-1M: 95<br>• 100K-500K: 90<br>• 50K-100K: 80<br>• 10K-50K: 70<br>• 5K-10K: 60<br>• 1K-5K: 50<br>• <1K: 40 |
| **Location Match** | 15% | • Pan India: 100<br>• City matches: 100<br>• No match: 50 |
| **Past Performance** | 10% | Base: 50<br>• +30 for campaigns (20+: 30, 10+: 25, 5+: 20, 3+: 15, 1+: 10)<br>• +20 for success rate (80%+: 20, 60%+: 15, 40%+: 10, 20%+: 5) |
| **Collaboration Charges** | 5% | • Within budget: 100<br>• Below budget: 70-80<br>• Slightly over: 60-70<br>• Too expensive: 30-40 |

#### Recommendation Levels:
- `highly_recommended`: Score ≥ 80
- `recommended`: Score ≥ 60
- `consider`: Score ≥ 40
- `not_recommended`: Score < 40

**Base Filter:** 
- `isProfileCompleted = true`
- `isActive = true`
- `isTopInfluencer = true`

---

### **2. ALL_PROFILE**

**Ordering:** `createdAt ASC` (oldest first) - **Can be changed with `sortBy` parameter**

#### Available Sort Options:
- `CREATED_AT` (default): Oldest to newest
- `POSTS`: Highest post count first
- `FOLLOWERS`: Highest follower count first
- `FOLLOWING`: Highest following count first
- `CAMPAIGNS`: Most completed campaigns first

**Scores:** All set to **0** (no scoring calculation)

#### Metrics Returned:
- `followersCount`: Count from `follows` table
- `followingCount`: Count from `follows` table
- `postsCount`: Count of active posts
- `completedCampaigns`: Count from experiences
- `engagementRate`: 0 (not calculated)
- `scoreBreakdown`: All zeros

**Base Filter:** 
- `isActive = true` only
- **Shows ALL active influencers regardless of profile completion or verification status**

---

### **3. VERIFIED_PROFILE**

**Ordering:** `createdAt ASC` (oldest first) - **Can be changed with `sortBy` parameter**

**Same sorting options as ALL_PROFILE**

**Scores:** All set to **0** (no scoring calculation)

**Metrics:** Same as ALL_PROFILE

**Base Filter:** 
- `isActive = true`
- `isProfileCompleted = true`
- `isVerified = true`

**Shows:** Only verified influencers with completed profiles

---

### **4. UNVERIFIED_PROFILE**

**Ordering:** `createdAt ASC` (oldest first) - **Can be changed with `sortBy` parameter**

**Same sorting options as ALL_PROFILE**

**Scores:** All set to **0** (no scoring calculation)

**Metrics:** Same as ALL_PROFILE

**Base Filter:** 
- `isActive = true`
- `isVerified = false`

**Shows:** All unverified influencers regardless of profile completion status (includes incomplete profiles)

---

## Summary Table

| Profile Type | Default Order | Scoring | Base Conditions | Purpose |
|--------------|---------------|---------|-----------------|---------|
| **TOP_PROFILE** | Overall Score DESC | ✅ Full 6-metric calculation | `isActive=true`<br>`isProfileCompleted=true`<br>`isTopInfluencer=true` | Campaign recommendations with scoring |
| **ALL_PROFILE** | createdAt ASC | ❌ All zeros | `isActive=true` | View all active influencers |
| **VERIFIED_PROFILE** | createdAt ASC | ❌ All zeros | `isActive=true`<br>`isProfileCompleted=true`<br>`isVerified=true` | View verified influencers only |
| **UNVERIFIED_PROFILE** | createdAt ASC | ❌ All zeros | `isActive=true`<br>`isVerified=false` | View unverified/pending verification |

---

## Engagement Rate Calculation

The engagement rate is calculated using the last 20 posts:

```typescript
engagementRate = (averageLikes / followersCount) × 100
```

### Scoring Scale:
- **Excellent**: 6%+ engagement → Score: 100
- **Very Good**: 5-6% engagement → Score: 85-100
- **Good**: 4-5% engagement → Score: 75-85
- **Average**: 3-4% engagement → Score: 60-75
- **Below Average**: 2-3% engagement → Score: 40-60
- **Low**: 1-2% engagement → Score: 20-40
- **Very Low**: 0-1% engagement → Score: 0-20

---

## Niche Match Score

Calculates how well influencer's niches align with campaign requirements:

```typescript
// No target niches specified
score = 70 (default)

// No matching niches
score = 30

// Perfect match (all target niches covered)
score = 100

// Partial match
matchPercentage = (matchingNiches / targetNiches) × 100
score = 50 + (matchPercentage / 2)
```

---

## Audience Relevance (Follower-Based)

| Follower Count | Category | Score |
|----------------|----------|-------|
| 1M+ | Mega Influencer | 100 |
| 500K - 1M | Major Influencer | 95 |
| 100K - 500K | Macro Influencer | 90 |
| 50K - 100K | Mid-tier Influencer | 80 |
| 10K - 50K | Micro Influencer | 70 |
| 5K - 10K | Nano Influencer | 60 |
| 1K - 5K | Emerging | 50 |
| < 1K | Starter | 40 |

---

## Past Performance Score

Base score: **50**

### Campaign Experience Bonus (max +30):
- 20+ campaigns: +30
- 10-19 campaigns: +25
- 5-9 campaigns: +20
- 3-4 campaigns: +15
- 1-2 campaigns: +10

### Success Rate Bonus (max +20):
- 80%+ success: +20
- 60-79% success: +15
- 40-59% success: +10
- 20-39% success: +5

**Maximum Score:** 100 (50 base + 30 campaigns + 20 success rate)

---

## Location Match Score

| Condition | Score |
|-----------|-------|
| Campaign is Pan India | 100 |
| No target cities specified | 100 |
| Influencer's city matches target | 100 |
| No match | 50 |

---

## Collaboration Charges Score

| Condition | Score |
|-----------|-------|
| No budget specified | 70 |
| Influencer hasn't set rates | 50 |
| Within min-max budget | 100 |
| Below min budget | 70-80 |
| Slightly over budget (≤20% over max) | 60-70 |
| Too expensive (>20% over max) | 30-40 |

---

## Database Queries

### Total Influencers (Dashboard):
```sql
SELECT COUNT(*) FROM influencers WHERE "isActive" = true;
```

### All Profile Influencers:
```sql
SELECT * FROM influencers WHERE "isActive" = true ORDER BY "createdAt" ASC;
```

### Verified Profile Influencers:
```sql
SELECT * FROM influencers 
WHERE "isActive" = true 
  AND "isProfileCompleted" = true 
  AND "isVerified" = true 
ORDER BY "createdAt" ASC;
```

### Unverified Profile Influencers:
```sql
SELECT * FROM influencers 
WHERE "isActive" = true 
  AND "isVerified" = false 
ORDER BY "createdAt" ASC;
```

### Top Profile Influencers:
```sql
SELECT * FROM influencers 
WHERE "isActive" = true 
  AND "isProfileCompleted" = true 
  AND "isTopInfluencer" = true;
-- Then scored and sorted by overall score in application
```

---

## API Usage

### Get Top Influencers with Scoring:
```
GET /api/admin/influencers?profileFilter=topProfile&page=1&limit=20
```

### Get All Influencers:
```
GET /api/admin/influencers?profileFilter=allProfile&sortBy=followers&page=1&limit=20
```

### Get Verified Influencers:
```
GET /api/admin/influencers?profileFilter=verifiedProfile&page=1&limit=20
```

### Get Unverified Influencers:
```
GET /api/admin/influencers?profileFilter=unverifiedProfile&page=1&limit=20
```

---

## Additional Filters

All profile types support:
- `searchQuery`: Search by name or username
- `locationSearch`: Filter by city name
- `nicheSearch`: Filter by niche name
- `minFollowers`: Minimum follower count
- `maxFollowers`: Maximum follower count

**Top Profile only:**
- `nicheIds`: Array of niche IDs for scoring
- `cityIds`: Array of city IDs for scoring
- `isPanIndia`: Boolean for Pan India campaigns
- `minBudget`: Minimum collaboration budget
- `maxBudget`: Maximum collaboration budget
- `minScore`: Minimum overall score threshold
- Custom weights for each scoring metric

---

## Notes

1. **Top Profile** is the only filter that calculates actual scores - all other filters return zero scores
2. **All Profile** shows truly all active influencers (87 in current database)
3. **Verified Profile** requires both verification AND complete profile
4. **Unverified Profile** shows all unverified, including incomplete profiles
5. Engagement rate is calculated from the last 20 posts for TOP_PROFILE only
6. Sorting options (posts, followers, following, campaigns) are only available for non-TOP profiles

---

*Last Updated: November 3, 2025*
