# Feed Priority System - Hybrid P1-P6 + Time-Based Degradation

## Overview
The post feed uses a **hybrid approach** that combines priority-based relevance (P1-P6) with recency ordering and **time-based degradation**. Posts older than 30 days from priority categories (P2/P3/P4) are automatically moved to P5, where they're intermixed with other general content by recency. This ensures users see fresh, relevant content first without stale posts blocking newer general content.

## How It Works

### Two-Level Ordering
```typescript
orderCondition = [
  Sequelize.literal(priorityCase),  // 1. Priority level (P1-P6)
  ['createdAt', 'DESC'],            // 2. Newest first within each priority
  ['likesCount', 'DESC'],           // 3. Engagement as tiebreaker
];
```

### Priority Levels (P1-P6)

#### **P1: Recent Own Posts** (Priority 1)
- **Criteria**: Your own posts created within the last 10 minutes
- **Purpose**: Keep your fresh posts visible at the top temporarily
- **Ordering**: Newest first
- **Time Limit**: Only posts < 10 minutes old

#### **P2: Followed + Same Niche (Recent)** (Priority 2)
- **Criteria**: Posts from profiles you follow AND match your niche interests, created within the last 30 days
- **Purpose**: Highly relevant fresh content from your network
- **Ordering**: Newest first
- **Time Limit**: Only posts < 30 days old
- **Time Degradation**: After 30 days, moves to P5
- **Example**: If you're a fitness influencer following fitness brands, their recent posts appear here

#### **P3: Same Niche, Not Followed (Recent)** (Priority 3)
- **Criteria**: Posts from profiles you DON'T follow but match your niches, created within the last 30 days
- **Purpose**: Fresh content discovery - find new relevant profiles
- **Ordering**: Newest first
- **Time Limit**: Only posts < 30 days old
- **Time Degradation**: After 30 days, moves to P5
- **Example**: Discover new fitness influencers even if you don't follow them yet

#### **P4: Followed, Different Niche (Recent)** (Priority 4)
- **Criteria**: Posts from profiles you follow but in different niches, created within the last 30 days
- **Purpose**: See fresh content from your network even outside your main interests
- **Ordering**: Newest first
- **Time Limit**: Only posts < 30 days old
- **Time Degradation**: After 30 days, moves to P5
- **Example**: You follow a travel brand but you're a food influencer

#### **P5: Other Posts + Stale Priority Posts** (Priority 5)
- **Criteria**:
  - Posts that don't match P1-P4 criteria
  - Old posts from P2/P3/P4 that are 30+ days old
- **Purpose**: General content pool mixed with degraded priority content
- **Ordering**: Newest first (all posts mixed by recency)
- **Key Feature**: Fresh general content appears before stale high-priority content

#### **P6: Old Own Posts** (Priority 6)
- **Criteria**: Your own posts older than 10 minutes
- **Purpose**: Your older posts appear at lowest priority
- **Ordering**: Newest first
- **Time Degradation**: Automatically moved here after 10 minutes

## The Key Fix: Recency Within Priority + Time Degradation

### ❌ Old Problem (Priority Only)
```
P2: Relevant post from 30 days ago
P2: Relevant post from 25 days ago
P3: New post from 1 hour ago ← Buried!
P3: New post from 2 hours ago
```

### ✅ New Solution (Priority + Recency + Time Degradation)
```
P2: Relevant post from 1 hour ago     ← Fresh P2 content
P2: Relevant post from 29 days ago    ← Still fresh (< 30 days)
P3: New post from 30 minutes ago      ← Fresh P3 content
P3: New post from 2 hours ago
P5: Random post from 20 mins ago      ← Fresh general content
P5: Relevant post from 35 days ago    ← Degraded from P2, but still shown by recency
P5: Old post from 40 days ago         ← Degraded from P3
```

## Real-World Example

**User**: Fitness brand following 5 fitness influencers, interested in health & wellness

**Feed Order**:
1. Your brand post from 5 mins ago (P1) ⭐
2. Followed fitness influencer post from 10 mins ago (P2) ⭐
3. Followed fitness influencer post from 1 hour ago (P2)
4. Followed fitness influencer post from 2 days ago (P2)
5. Non-followed fitness influencer from 30 mins ago (P3) 🔍 Discovery!
6. Non-followed health brand from 1 hour ago (P3)
7. Followed travel brand (different niche) from 45 mins ago (P4)
8. Random post from 20 mins ago (P5) ← Fresh general content
9. Followed fitness influencer post from 35 days ago (P5) ⏰ Stale but mixed by recency
10. Random post from 2 days ago (P5)
11. Non-followed health brand from 40 days ago (P5) ⏰ Stale discovery
12. Your brand post from 3 days ago (P6) 🕐 Your old content

## Benefits

✅ **Relevance**: P1-P6 system ensures important content rises to the top
✅ **Freshness**: Newest posts within each priority appear first
✅ **Time Degradation**: Old posts (30+ days) from P2/P3/P4 automatically move to P5
✅ **Smart Mixing**: Stale priority posts don't block fresh general content
✅ **Discovery**: P3 shows relevant content from profiles you don't follow yet
✅ **Network**: P2/P4 prioritizes your followed profiles
✅ **Personalization**: Niche matching creates a curated experience
✅ **Balance**: Combines algorithmic curation with chronological ordering
✅ **Content Rotation**: Users see fresh content from all sources before stale content

## SQL Example

```sql
ORDER BY
  -- Priority Level (P1-P6 with time degradation)
  CASE
    WHEN (own post < 10 min old) THEN 1
    WHEN (niche match AND followed AND < 30 days old) THEN 2
    WHEN (niche match AND NOT followed AND < 30 days old) THEN 3
    WHEN (followed AND NOT niche AND < 30 days old) THEN 4
    WHEN (niche match AND followed AND >= 30 days old) THEN 5
    WHEN (niche match AND NOT followed AND >= 30 days old) THEN 5
    WHEN (followed AND NOT niche AND >= 30 days old) THEN 5
    WHEN (own post >= 10 min old) THEN 6
    ELSE 5
  END,
  -- Recency within priority
  "createdAt" DESC,
  -- Engagement as tiebreaker
  "likesCount" DESC
```

## Filters Applied

The feed shows **ALL posts** but prioritizes them using the P1-P6 system:
- ✅ All posts are visible (no filtering)
- ✅ P1: Your very recent posts (<10 min) appear at the top
- ✅ P2-P4: High priority fresh posts (<30 days) appear first (followed, niche-matching)
- ✅ P5: All other posts + Stale priority posts (30+ days) - mixed by recency
- ✅ P6: Your old posts (>10 min) appear at the bottom

## Implementation Files

- **Main Logic**: `src/post/post.service.ts` (lines 343-415)
- **Priority Builder**: `buildPriorityCase()` method (lines 590-688)
- **Niche Matching**: `getNicheMatchingUserIds()` method
- **Following Users**: `getFollowingUsers()` method

## Performance Notes

- Niche matching queries are cached per user
- Following lists are loaded once per feed request
- SQL CASE statement runs in single query (no N+1 problem)
- Indexes on `createdAt`, `userType`, `influencerId`, `brandId` optimize sorting

---

**Last Updated**: October 31, 2025
**Version**: 3.0 - Hybrid Priority + Recency + Time-Based Degradation System
