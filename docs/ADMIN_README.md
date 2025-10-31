# Admin API Documentation - Ordering, Metrics & Notifications

## Table of Contents
1. [Overview](#overview)
2. [Admin Dashboard APIs](#admin-dashboard-apis)
   - [Get Top Brands](#get-top-brands)
   - [Get Top Influencers](#get-top-influencers)
   - [Get Top Campaigns](#get-top-campaigns)
   - [Get Brands (with Filters)](#get-brands-with-filters)
   - [Get Influencers (with Filters)](#get-influencers-with-filters)
3. [Metrics & Scoring System](#metrics--scoring-system)
   - [Brand Metrics](#brand-metrics)
   - [Influencer Metrics](#influencer-metrics)
   - [Campaign Metrics](#campaign-metrics)
4. [Sorting & Ordering](#sorting--ordering)
5. [Push Notification System](#push-notification-system)
6. [Manual Ordering System](#manual-ordering-system)

---

## Overview

This document provides comprehensive documentation for admin APIs including:
- **Dashboard APIs** for fetching top-performing brands, influencers, and campaigns
- **Metrics & Scoring** algorithms used to rank and order results
- **Push Notification System** for broadcasting messages to users
- **Manual Ordering** capabilities for featured content

---

## Admin Dashboard APIs

### Get Top Brands

**Endpoint**: `GET /api/admin/dashboard/top-brands`

**Description**: Get top-performing brands based on comprehensive metrics including campaigns launched, niche diversity, influencers selected, and average payout.

#### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortBy` | Enum | `composite` | Sort metric: `campaigns`, `niches`, `influencers`, `payout`, `composite` |
| `timeframe` | Enum | `all` | Time filter: `30d`, `90d`, `all` |
| `limit` | Number | 10 | Number of results (1-50) |

#### Sort Options

- **`campaigns`**: Total number of campaigns launched
- **`niches`**: Number of unique niches targeted
- **`influencers`**: Total influencers selected across campaigns
- **`payout`**: Average payout per campaign
- **`composite`**: Weighted combination of all metrics

#### Response Structure

```json
{
  "brands": [
    {
      "id": 123,
      "brandName": "Nike India",
      "username": "nikeindia",
      "email": "contact@nike.com",
      "profileImage": "https://...",
      "brandBio": "Leading sports brand in India",
      "websiteUrl": "https://nike.com",
      "isVerified": true,
      "isTopBrand": false,
      "metrics": {
        "totalCampaigns": 15,
        "uniqueNichesCount": 8,
        "selectedInfluencersCount": 45,
        "averagePayout": 25000.5,
        "compositeScore": 85.5
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "sortBy": "composite",
  "timeframe": "all",
  "limit": 10
}
```

#### Ordering Logic

1. **Manual Order First**: Brands with `displayOrder` set (see [Manual Ordering](#manual-ordering-system))
2. **Auto-Scored Second**: Sorted by selected `sortBy` metric (DESC)

**Example Request**:
```http
GET /api/admin/dashboard/top-brands?sortBy=composite&timeframe=30d&limit=20
Authorization: Bearer <admin-token>
```

---

### Get Top Influencers

**Endpoint**: `GET /api/admin/dashboard/top-influencers`

**Description**: Get top influencers with comprehensive AI-powered scoring based on 6 key metrics. Admins can customize weights for each metric.

#### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `searchQuery` | String | - | Search by name or username |
| `locationSearch` | String | - | Filter by city name |
| `nicheSearch` | String | - | Filter by niche name |
| `nicheIds` | Array | - | Target niche IDs for matching |
| `cityIds` | Array | - | Target city IDs for location matching |
| `isPanIndia` | Boolean | false | Ignore city matching if true |
| `minFollowers` | Number | - | Minimum follower count |
| `maxFollowers` | Number | - | Maximum follower count |
| `minBudget` | Number | - | Minimum collaboration charges |
| `maxBudget` | Number | - | Maximum collaboration charges |
| `minScore` | Number | - | Minimum overall score (0-100) |
| `page` | Number | 1 | Page number for pagination |
| `limit` | Number | 20 | Results per page (1-100) |

#### Scoring Weights (Customizable)

| Weight Parameter | Default | Description |
|------------------|---------|-------------|
| `nicheMatchWeight` | 30 | Niche alignment importance |
| `engagementRateWeight` | 25 | Engagement rate importance |
| `audienceRelevanceWeight` | 15 | Audience quality importance |
| `locationMatchWeight` | 15 | Location match importance |
| `pastPerformanceWeight` | 10 | Campaign history importance |
| `collaborationChargesWeight` | 5 | Budget match importance |

**Default Weights**: Must total 100

#### Response Structure

```json
{
  "influencers": [
    {
      "id": 456,
      "name": "Jane Doe",
      "username": "janedoe",
      "profileImage": "https://...",
      "followerCount": 50000,
      "engagementRate": 5.2,
      "city": "Mumbai",
      "niches": ["Fashion", "Lifestyle"],
      "isVerified": true,
      "isTopInfluencer": true,
      "displayOrder": null,
      "scoreBreakdown": {
        "overallScore": 85.5,
        "nicheMatchScore": 90,
        "engagementRateScore": 85,
        "audienceRelevanceScore": 80,
        "locationMatchScore": 100,
        "pastPerformanceScore": 70,
        "collaborationChargesScore": 75
      },
      "metrics": {
        "totalCampaigns": 12,
        "completedCampaigns": 10,
        "averageRating": 4.8
      },
      "createdAt": "2024-01-10T08:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Ordering Logic

1. **Manual Order First**: Influencers with `displayOrder` set (1, 2, 3...)
2. **Auto-Scored Second**: Sorted by `overallScore` DESC

**Example Request**:
```http
GET /api/admin/dashboard/top-influencers?nicheIds=1,2&minFollowers=10000&nicheMatchWeight=40&engagementRateWeight=30&limit=50
Authorization: Bearer <admin-token>
```

---

### Get Top Campaigns

**Endpoint**: `GET /api/admin/dashboard/top-campaigns`

**Description**: Get top-performing campaigns based on comprehensive metrics including applications, conversion rate, budget, geographic reach, and completion rate.

#### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortBy` | Enum | `composite` | Sort metric (see options below) |
| `timeframe` | Enum | `all` | Time filter: `7d`, `30d`, `90d`, `all` |
| `status` | Enum | `all` | Status filter: `all`, `active`, `completed` |
| `verifiedBrandsOnly` | Boolean | false | Only show campaigns from verified brands |
| `limit` | Number | 10 | Number of results (1-50) |

#### Sort Options

**Application Metrics**:
- `applications_count`: Total applications received
- `conversion_rate`: Application to selection rate (%)
- `applicant_quality`: Average applicant quality score

**Budget Metrics**:
- `total_budget`: Total campaign budget
- `budget_per_deliverable`: Budget per deliverable item

**Scope Metrics**:
- `geographic_reach`: Geographic reach score (0-100)
- `cities_count`: Number of cities targeted
- `niches_count`: Number of niches targeted

**Engagement Metrics**:
- `selected_influencers`: Number of influencers selected
- `completion_rate`: Campaign completion rate (%)

**Recency Metrics**:
- `recently_launched`: Days since campaign launch
- `recently_active`: Days since last application

**Overall**:
- `composite`: Weighted combination of all metrics

#### Response Structure

```json
{
  "campaigns": [
    {
      "id": 789,
      "name": "Summer Fashion Campaign 2024",
      "description": "Promote our new summer collection",
      "category": "Fashion",
      "type": "paid",
      "status": "active",
      "deliverables": [
        {
          "id": 1,
          "platform": "instagram",
          "type": "instagram_post",
          "budget": 5000,
          "quantity": 2,
          "specifications": "Post must include brand hashtag"
        }
      ],
      "brand": {
        "id": 45,
        "brandName": "Nike India",
        "username": "nikeindia",
        "profileImage": "https://...",
        "isVerified": true
      },
      "metrics": {
        "application": {
          "applicationsCount": 125,
          "conversionRate": 24.5,
          "applicantQuality": 75.5
        },
        "budget": {
          "totalBudget": 150000,
          "budgetPerDeliverable": 5000,
          "deliverablesCount": 30
        },
        "scope": {
          "isPanIndia": true,
          "citiesCount": 5,
          "nichesCount": 3,
          "geographicReach": 85.5
        },
        "engagement": {
          "selectedInfluencers": 15,
          "completionRate": 80.5,
          "status": "active"
        },
        "recency": {
          "daysSinceLaunch": 15,
          "daysSinceLastApplication": 2,
          "createdAt": "2024-01-15T10:30:00Z"
        },
        "compositeScore": 82.5
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 45,
  "sortBy": "composite",
  "timeframe": "all",
  "statusFilter": "all",
  "limit": 10
}
```

#### Ordering Logic

Sorted by selected `sortBy` metric in descending order (highest first).

**Example Request**:
```http
GET /api/admin/dashboard/top-campaigns?sortBy=conversion_rate&timeframe=30d&status=active&limit=20
Authorization: Bearer <admin-token>
```

---

### Get Brands (with Filters)

**Endpoint**: `GET /api/admin/brands`

**Description**: Get brands with advanced filtering, search, and sorting capabilities. Supports profile filters for all, top, verified, and unverified brands.

#### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `profileFilter` | Enum | `allProfile` | Profile filter: `allProfile`, `topProfile`, `verifiedProfile`, `unverifiedProfile` |
| `searchQuery` | String | - | Search by brand name or username |
| `locationSearch` | String | - | Search by city |
| `nicheSearch` | String | - | Search by niche |
| `sortBy` | Enum | `createdAt` | Sort by: `posts`, `followers`, `following`, `campaigns`, `createdAt` |
| `sortOrder` | Enum | `DESC` | Sort direction: `ASC`, `DESC` |
| `page` | Number | 1 | Page number |
| `limit` | Number | 20 | Results per page |

#### Profile Filters

- **`allProfile`**: All brands (default)
- **`topProfile`**: Only brands marked as top (`isTopBrand = true`), scored using same metrics as top-brands API
- **`verifiedProfile`**: Only verified brands (`isVerified = true`)
- **`unverifiedProfile`**: Only unverified brands (`isVerified = false`)

#### Ordering Logic

- **For `topProfile`**:
  1. Manual `displayOrder` first (1, 2, 3...)
  2. Auto-scored by composite score (DESC)
- **For other filters**: Sorted by `sortBy` parameter

**Example Request**:
```http
GET /api/admin/brands?profileFilter=topProfile&searchQuery=nike&sortBy=campaigns&limit=50
Authorization: Bearer <admin-token>
```

---

### Get Influencers (with Filters)

**Endpoint**: `GET /api/admin/influencers`

**Description**: Get influencers with advanced filtering, search, and sorting capabilities. Supports profile filters for all, top, verified, and unverified influencers.

#### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `profileFilter` | Enum | `allProfile` | Profile filter: `allProfile`, `topProfile`, `verifiedProfile`, `unverifiedProfile` |
| `searchQuery` | String | - | Search by name or username |
| `locationSearch` | String | - | Search by city |
| `nicheSearch` | String | - | Search by niche |
| `sortBy` | Enum | `createdAt` | Sort by: `posts`, `followers`, `following`, `campaigns`, `createdAt` |
| `sortOrder` | Enum | `DESC` | Sort direction: `ASC`, `DESC` |
| `page` | Number | 1 | Page number |
| `limit` | Number | 20 | Results per page |
| Scoring weights | Numbers | See above | Same as Get Top Influencers |

#### Profile Filters

- **`allProfile`**: All influencers (default)
- **`topProfile`**: Only influencers marked as top (`isTopInfluencer = true`), scored using same metrics as top-influencers API
- **`verifiedProfile`**: Only verified influencers (`isVerified = true`)
- **`unverifiedProfile`**: Only unverified influencers (`isVerified = false`)

#### Ordering Logic

- **For `topProfile`**:
  1. Manual `displayOrder` first (1, 2, 3...)
  2. Auto-scored by `overallScore` (DESC)
- **For other filters**: Sorted by `sortBy` parameter

**Example Request**:
```http
GET /api/admin/influencers?profileFilter=topProfile&locationSearch=Mumbai&sortBy=followers&limit=50
Authorization: Bearer <admin-token>
```

---

## Metrics & Scoring System

### Brand Metrics

#### Composite Score Calculation

The brand composite score (0-100) is calculated using **equal weights** for all 4 metrics:

```javascript
// Step 1: Calculate raw metrics
totalCampaigns = COUNT(campaigns WHERE status != 'cancelled')
uniqueNichesCount = COUNT(DISTINCT nicheId FROM campaigns.nicheIds)
selectedInfluencersCount = SUM(applications WHERE status = 'selected')
averagePayout = AVG(SUM(deliverables.budget) per campaign)

// Step 2: Normalize each metric to 0-100 scale
normalizedCampaigns = (totalCampaigns / maxCampaigns) × 100
normalizedNiches = (uniqueNichesCount / maxNiches) × 100
normalizedInfluencers = (selectedInfluencersCount / maxInfluencers) × 100
normalizedPayout = (averagePayout / maxPayout) × 100

// Step 3: Calculate composite score (equal 25% weights)
compositeScore =
  (normalizedCampaigns × 0.25) +
  (normalizedNiches × 0.25) +
  (normalizedInfluencers × 0.25) +
  (normalizedPayout × 0.25)
```

**Weights (Fixed)**:
- Total Campaigns: 25%
- Niche Diversity: 25%
- Influencers Selected: 25%
- Average Payout: 25%

**Normalization**: Each metric is normalized to 0-100 scale using the maximum value across all brands in the dataset.

#### Metrics Breakdown

| Metric | Description | Calculation |
|--------|-------------|-------------|
| `totalCampaigns` | Campaigns launched (excluding cancelled) | COUNT(campaigns WHERE status ≠ 'cancelled') |
| `uniqueNichesCount` | Unique niches targeted | COUNT(DISTINCT nicheIds FROM all campaigns) |
| `selectedInfluencersCount` | Total influencers selected across all campaigns | SUM(applications WHERE status = 'selected') |
| `averagePayout` | Average payout per campaign | AVG(SUM(deliverable.budget) per campaign) |

#### Filtering

Only brands matching these criteria appear in top brands:
- `isVerified = true`
- `isActive = true`
- `isProfileCompleted = true`
- `isTopBrand = true` (admin must mark as top)

#### Timeframe Filtering

- **30d**: Only campaigns created in last 30 days
- **90d**: Only campaigns created in last 90 days
- **all**: All campaigns (no date filter)

---

### Influencer Metrics

#### Scoring Algorithm (6 Metrics)

The influencer overall score (0-100) is calculated using **customizable weights**:

```javascript
overallScore = (
  (nicheMatchWeight × nicheMatchScore) +
  (engagementRateWeight × engagementRateScore) +
  (audienceRelevanceWeight × audienceRelevanceScore) +
  (locationMatchWeight × locationMatchScore) +
  (pastPerformanceWeight × pastPerformanceScore) +
  (collaborationChargesWeight × collaborationChargesScore)
) / 100
```

**Default Weights**: 30% + 25% + 15% + 15% + 10% + 5% = 100%

#### 1. Niche Match Score (Default: 30%)

**Formula**:
```javascript
influencerNicheIds = GET niches associated with influencer
matchingNiches = INTERSECTION(influencerNicheIds, targetNicheIds)

if (no target niches specified) return 70  // Default score
if (influencer has no niches) return 30    // Low score

matchPercentage = (matchingNiches.length / targetNicheIds.length) × 100

if (all target niches matched) return 100
else return 50 + (matchPercentage / 2)     // Partial match: 50-100
```

**Scoring**:
- **Perfect Match** (100): All target niches matched
- **Partial Match** (50-99): Some niches overlap (scaled from 50%)
- **No Match** (30): No niche overlap
- **Default** (70): No target niches specified

#### 2. Engagement Rate Score (Default: 25%)

**Formula**:
```javascript
// Get last 20 posts
posts = GET last 20 posts ORDER BY createdAt DESC
averageLikes = SUM(posts.likesCount) / posts.length
followersCount = COUNT(followers)

engagementRate = (averageLikes / followersCount) × 100

// Scoring tiers
if (engagementRate >= 6%) return 100
if (engagementRate >= 5%) return 85 + (rate - 5) × 15  // 85-100
if (engagementRate >= 4%) return 75 + (rate - 4) × 10  // 75-85
if (engagementRate >= 3%) return 60 + (rate - 3) × 15  // 60-75
if (engagementRate >= 2%) return 40 + (rate - 2) × 20  // 40-60
if (engagementRate >= 1%) return 20 + (rate - 1) × 20  // 20-40
else return rate × 20  // 0-20
```

**Scoring Tiers**:
- **Excellent** (100): 6%+ engagement rate
- **Very Good** (85-99): 5-6% engagement rate
- **Good** (75-84): 4-5% engagement rate
- **Average** (60-74): 3-4% engagement rate
- **Fair** (40-59): 2-3% engagement rate
- **Low** (20-39): 1-2% engagement rate
- **Very Low** (0-19): <1% engagement rate
- **Default** (50): No posts available

#### 3. Audience Relevance Score (Default: 15%)

Based on **follower count tiers**:

```javascript
followersCount = COUNT(followers)

if (followersCount >= 1,000,000) return 100   // Mega influencer (1M+)
if (followersCount >= 500,000) return 95      // Major influencer (500K-1M)
if (followersCount >= 100,000) return 90      // Macro influencer (100K-500K)
if (followersCount >= 50,000) return 80       // Mid-tier influencer (50K-100K)
if (followersCount >= 10,000) return 70       // Micro influencer (10K-50K)
if (followersCount >= 5,000) return 60        // Nano influencer (5K-10K)
if (followersCount >= 1,000) return 50        // Emerging (1K-5K)
else return 40                                 // Below 1K
```

**Influencer Tiers**:
- **Mega** (100): 1M+ followers
- **Major** (95): 500K-1M followers
- **Macro** (90): 100K-500K followers
- **Mid-tier** (80): 50K-100K followers
- **Micro** (70): 10K-50K followers
- **Nano** (60): 5K-10K followers
- **Emerging** (50): 1K-5K followers
- **Starter** (40): <1K followers

#### 4. Location Match Score (Default: 15%)

**Formula**:
```javascript
if (isPanIndia) return 100              // Campaign is Pan-India
if (no targetCityIds) return 100        // No location requirement
if (influencer.cityId IN targetCityIds) return 100  // Perfect match
else return 50                          // No match
```

**Scoring**:
- **Perfect Match** (100): City matches or Pan-India campaign
- **No Location Filter** (100): No city requirements
- **No Match** (50): City doesn't match

#### 5. Past Performance Score (Default: 10%)

**Formula**:
```javascript
experiences = COUNT(experiences)  // Completed campaigns
totalApplications = COUNT(applications)
acceptedApplications = COUNT(applications WHERE status = 'selected')

successRate = (acceptedApplications / totalApplications) × 100

score = 50  // Base score

// Add points for experience (max +30)
if (experiences >= 20) score += 30
else if (experiences >= 10) score += 25
else if (experiences >= 5) score += 20
else if (experiences >= 3) score += 15
else if (experiences >= 1) score += 10

// Add points for success rate (max +20)
if (successRate >= 80%) score += 20
else if (successRate >= 60%) score += 15
else if (successRate >= 40%) score += 10
else if (successRate >= 20%) score += 5

return MIN(score, 100)
```

**Scoring Components**:
- **Base Score**: 50
- **Experience Points** (max +30):
  - 20+ campaigns: +30
  - 10-19 campaigns: +25
  - 5-9 campaigns: +20
  - 3-4 campaigns: +15
  - 1-2 campaigns: +10
  - 0 campaigns: +0
- **Success Rate Points** (max +20):
  - 80%+ selection rate: +20
  - 60-79%: +15
  - 40-59%: +10
  - 20-39%: +5
  - <20%: +0

#### 6. Collaboration Charges Score (Default: 5%)

**Formula**:
```javascript
instagramPostCost = influencer.collaborationCosts.instagram.post

// No budget or no rates set
if (no minBudget && no maxBudget) return 70  // Default
if (postCost == 0) return 50                  // No rates set

// Only min budget specified
if (minBudget && !maxBudget) {
  if (postCost >= minBudget && postCost <= minBudget × 2) return 100
  if (postCost < minBudget) return 70  // Below budget (good for brand)
  if (postCost <= minBudget × 3) return 60  // Slightly over
  return 40  // Too expensive
}

// Only max budget specified
if (!minBudget && maxBudget) {
  if (postCost <= maxBudget) return 100
  if (postCost <= maxBudget × 1.2) return 70  // Slightly over
  return 40  // Too expensive
}

// Both min and max specified
if (minBudget && maxBudget) {
  if (postCost >= minBudget && postCost <= maxBudget) return 100  // Perfect
  if (postCost < minBudget) return 80  // Below range (still good)
  if (postCost <= maxBudget × 1.2) return 60  // Slightly over
  return 30  // Too expensive
}
```

**Scoring**:
- **Perfect Match** (100): Within budget range
- **Below Budget** (70-80): Good for brand
- **Slightly Over** (60-70): Within 20% of max
- **Too Expensive** (30-40): Exceeds budget significantly
- **No Rates Set** (50): Default score

#### Filtering

Only influencers matching these criteria appear in top influencers:
- `isProfileCompleted = true`
- `isActive = true`
- `isTopInfluencer = true` (admin must mark as top)

#### Recommendation Levels

Based on overall score:
- **Highly Recommended** (80-100): Excellent match
- **Recommended** (60-79): Good match
- **Consider** (40-59): Potential match
- **Not Recommended** (<40): Poor match

---

### Campaign Metrics

#### Composite Score Calculation

The campaign composite score (0-100) uses **11 weighted metrics**:

```javascript
// Step 1: Calculate raw metrics
applicationsCount = COUNT(applications)
conversionRate = (selectedInfluencers / applicationsCount) × 100
applicantQuality = AVG(influencer scores of applicants)
totalBudget = SUM(deliverables.budget)
budgetPerDeliverable = totalBudget / deliverablesCount
geographicReach = isPanIndia ? 100 : (citiesCount / totalCitiesInSystem) × 100
nichesCount = LENGTH(campaign.nicheIds)
selectedInfluencers = COUNT(applications WHERE status = 'selected')
completionRate = (completedDeliverables / totalDeliverables) × 100
daysSinceLaunch = DAYS_DIFF(NOW, campaign.createdAt)
daysSinceLastApplication = DAYS_DIFF(NOW, MAX(applications.createdAt))

// Step 2: Normalize each metric to 0-100 scale
normalizedApplications = (applicationsCount / maxApplications) × 100
normalizedConversionRate = conversionRate  // Already 0-100
normalizedApplicantQuality = applicantQuality  // Already 0-100
normalizedTotalBudget = (totalBudget / maxBudget) × 100
normalizedBudgetPerDel = (budgetPerDeliverable / maxBudgetPerDel) × 100
normalizedGeographicReach = geographicReach  // Already 0-100
normalizedNiches = (nichesCount / maxNiches) × 100
normalizedSelectedInfluencers = (selectedInfluencers / maxSelected) × 100
normalizedCompletionRate = completionRate  // Already 0-100
normalizedRecencyLaunch = 100 - (daysSinceLaunch / maxDaysSinceLaunch) × 100
normalizedRecencyActivity = 100 - MIN((daysSinceLastApplication / 30) × 100, 100)

// Step 3: Calculate composite score with fixed weights
compositeScore =
  (normalizedApplications × 0.10) +        // 10% - Application volume
  (normalizedConversionRate × 0.15) +      // 15% - Selection success
  (normalizedApplicantQuality × 0.05) +    // 5%  - Applicant quality
  (normalizedTotalBudget × 0.10) +         // 10% - Total investment
  (normalizedBudgetPerDel × 0.10) +        // 10% - Per-deliverable budget
  (normalizedGeographicReach × 0.08) +     // 8%  - Geographic scope
  (normalizedNiches × 0.07) +              // 7%  - Niche diversity
  (normalizedSelectedInfluencers × 0.15) + // 15% - Influencer count
  (normalizedCompletionRate × 0.10) +      // 10% - Completion rate
  (normalizedRecencyLaunch × 0.05) +       // 5%  - Recent launch
  (normalizedRecencyActivity × 0.05)       // 5%  - Recent activity
```

**Weights (Fixed)**:
- **Application Metrics (30%)**:
  - Applications count: 10%
  - Conversion rate: 15%
  - Applicant quality: 5%
- **Budget Metrics (20%)**:
  - Total budget: 10%
  - Budget per deliverable: 10%
- **Scope Metrics (15%)**:
  - Geographic reach: 8%
  - Niches count: 7%
- **Engagement Metrics (25%)**:
  - Selected influencers: 15%
  - Completion rate: 10%
- **Recency Metrics (10%)**:
  - Recently launched: 5%
  - Recently active: 5%

#### Metrics Breakdown

**Application Metrics**:
- `applicationsCount`: Total applications received
- `conversionRate`: (selectedInfluencers / applicationsCount) × 100
- `applicantQuality`: Average overall score of influencers who applied

**Budget Metrics**:
- `totalBudget`: SUM of all deliverable budgets (INR)
- `budgetPerDeliverable`: totalBudget / deliverablesCount
- `deliverablesCount`: Total number of deliverables required

**Scope Metrics**:
- `isPanIndia`: Boolean - campaign targets all of India
- `citiesCount`: Number of cities in campaign.cities array
- `nichesCount`: Number of niches in campaign.nicheIds array
- `geographicReach`:
  - If Pan-India: 100
  - Else: (citiesCount / totalCitiesInSystem) × 100

**Engagement Metrics**:
- `selectedInfluencers`: COUNT(applications WHERE status = 'selected')
- `completionRate`: Percentage of deliverables completed
- `status`: Campaign status (active, completed, cancelled, etc.)

**Recency Metrics**:
- `daysSinceLaunch`: Days since campaign.createdAt
- `daysSinceLastApplication`: Days since most recent application
  - Newer campaigns score higher (inverse)
  - Recent activity (applications) scores higher

#### Filtering

Campaigns can be filtered by:
- **Timeframe**: Only campaigns created within specified period (7d, 30d, 90d, all)
- **Status**: Filter by campaign status (all, active, completed)
- **Verified Brands Only**: Only show campaigns from verified brands

#### Normalization

All metrics are normalized to 0-100 scale using the maximum value across all campaigns in the filtered set.

---

## Sorting & Ordering

### Priority Order System

All "top" APIs use a two-tier ordering system:

#### 1. Manual Ordering (Priority 1)

Items with `displayOrder` field set appear first:
- Sorted by `displayOrder` ASC (1, 2, 3, 4...)
- Allows admins to feature specific brands/influencers/campaigns

**Setting Manual Order**:
```http
PUT /api/admin/influencer/:id/display-order
{ "displayOrder": 1 }
```

See [Manual Ordering System](#manual-ordering-system) for details.

#### 2. Automatic Scoring (Priority 2)

Items without `displayOrder` (or `displayOrder = null`) follow:
- Sorted by metric score DESC (highest first)
- Uses composite score or selected `sortBy` metric

### Example Order

```
Results for GET /api/admin/dashboard/top-influencers:

1. Alice (displayOrder: 1, score: 65)    ← Manual order
2. Bob (displayOrder: 2, score: 82)      ← Manual order
3. Charlie (displayOrder: null, score: 95)  ← Auto-scored
4. Diana (displayOrder: null, score: 88)    ← Auto-scored
5. Eve (displayOrder: null, score: 75)      ← Auto-scored
```

**Why this works**: Featured content (manually ordered) appears at top, followed by algorithmically ranked content.

---

## Push Notification System

### Overview

The push notification system allows admins to send targeted notifications to users via Firebase Cloud Messaging (FCM).

### Architecture

1. **Admin Creates Notification**: Define title, body, target audience, filters
2. **Recipient Filtering**: System filters users based on criteria
3. **FCM Token Check**: Only sends to users with valid FCM tokens
4. **Batch Sending**: Sends to all recipients sequentially
5. **Result Tracking**: Records success/failure counts

### Notification Lifecycle

```
DRAFT → SCHEDULED → SENT/FAILED
```

- **DRAFT**: Created but not sent
- **SCHEDULED**: Set for future delivery
- **SENT**: Successfully sent to recipients
- **FAILED**: All sends failed

### API Endpoints

#### Create Notification

```http
POST /api/admin/push-notifications
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "New Campaign Alert!",
  "body": "Check out our latest fashion campaign",
  "receiverType": "all_influencers",
  "locations": ["Mumbai", "Delhi"],
  "genderFilter": "all",
  "minAge": 18,
  "maxAge": 35,
  "nicheIds": [1, 2, 5],
  "isPanIndia": false,
  "scheduledAt": "2024-02-01T10:00:00Z",
  "metadata": {
    "campaignId": 123,
    "link": "https://app.com/campaign/123"
  }
}
```

#### Send Notification

```http
POST /api/admin/push-notifications/:id/send
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "message": "Notification sent successfully to 145 out of 150 recipients",
  "notification": {
    "id": 1,
    "status": "sent",
    "totalRecipients": 150,
    "successCount": 145,
    "failureCount": 5
  }
}
```

### Receiver Types

| Type | Description | Requires `specificReceivers` |
|------|-------------|------------------------------|
| `all_users` | All influencers + brands | No |
| `all_influencers` | All influencers | No |
| `all_brands` | All brands | No |
| `influencers` | Specific influencers | Yes |
| `brands` | Specific brands | Yes |
| `specific_users` | Mixed specific users | Yes |

### Filtering Options

#### Location Filtering

```json
{
  "locations": ["Mumbai", "Delhi", "Bangalore"],
  "isPanIndia": false
}
```

- **`isPanIndia: true`**: Ignores location filter, sends to all cities
- **`isPanIndia: false`**: Only sends to users in specified cities

#### Age Filtering

```json
{
  "minAge": 18,
  "maxAge": 35
}
```

Only sends to users with age in range `[minAge, maxAge]`.

#### Gender Filtering

```json
{
  "genderFilter": "male" // Options: "all", "male", "female", "other"
}
```

#### Niche Filtering (Influencers Only)

```json
{
  "nicheIds": [1, 2, 5]
}
```

Only sends to influencers with at least one matching niche.

### Recipient Selection Logic

```sql
-- Example: all_influencers with filters
SELECT id, fcmToken
FROM influencers
WHERE
  fcmToken IS NOT NULL  -- Has FCM token
  AND city IN ('Mumbai', 'Delhi')  -- Location filter
  AND gender = 'female'  -- Gender filter
  AND age BETWEEN 18 AND 35  -- Age filter
  AND id IN (
    SELECT influencerId FROM influencer_niches WHERE nicheId IN (1, 2, 5)
  )  -- Niche filter
```

### How It Works

1. **Filter Recipients**: Query database for users matching all criteria
2. **Extract FCM Tokens**: Only users with valid FCM tokens
3. **Send Notifications**: Call `notificationService.sendCustomNotification()` for each token
4. **Track Results**: Count successes and failures
5. **Update Status**: Mark notification as SENT or FAILED

### Firebase Integration

The system uses the `NotificationService` which integrates with Firebase Cloud Messaging:

```typescript
await notificationService.sendCustomNotification(
  fcmToken,      // User's FCM token
  title,         // Notification title
  body,          // Notification body
  metadata       // Additional data (deep links, campaign IDs, etc.)
);
```

### FCM Token Management

**Setting FCM Token** (User APIs):
```http
PUT /api/influencer/fcm-token
{ "fcmToken": "dnDR8seBEqTKfoDhvG0e6W:APA91b..." }
```

**Clearing FCM Token** (Logout):
```http
PUT /api/influencer/fcm-token
{ "fcmToken": null }
```

### Metadata Usage

The `metadata` field allows custom data for deep linking and context:

```json
{
  "metadata": {
    "type": "campaign_alert",
    "campaignId": 123,
    "deepLink": "incollabe://campaign/123",
    "action": "view_campaign"
  }
}
```

Mobile apps can parse `metadata` to handle notification taps.

### Best Practices

1. **Test with Small Groups**: Use `specific_users` to test before broadcasting
2. **Schedule Off-Peak**: Schedule notifications during high-engagement times
3. **Segment Audiences**: Use filters to target relevant users
4. **Track Performance**: Monitor success/failure counts
5. **Clear Messaging**: Keep title concise (40-50 chars), body informative (100-150 chars)

---

## Manual Ordering System

Admins can manually control the ordering of top influencers and brands using the `displayOrder` field.

### Key Concepts

- **`isTopInfluencer`/`isTopBrand`**: Mark as "top" to appear in top lists
- **`displayOrder`**: Manual position (1-1000, or `null` for auto-scoring)

### Workflow

**Step 1: Mark as Top**
```http
PUT /api/admin/influencer/:id/top-status
{ "isTopInfluencer": true }
```

**Step 2: Set Display Order (Optional)**
```http
PUT /api/admin/influencer/:id/display-order
{ "displayOrder": 1 }
```

**Step 3: Remove Manual Order**
```http
PUT /api/admin/influencer/:id/display-order
{ "displayOrder": null }  // Returns to auto-scoring
```

### Sorting Logic

1. **Manual order first**: Items with `displayOrder` (sorted 1, 2, 3...)
2. **Auto-scored second**: Items with `displayOrder = null` (sorted by score DESC)

### Use Cases

- **Promote New Talent**: Feature promising new influencers at top
- **Sponsored Placement**: Position paid/sponsored profiles
- **Editorial Control**: Override algorithmic ranking for special cases

### Full Documentation

See [TOP_INFLUENCERS_BRANDS_ORDERING.md](./TOP_INFLUENCERS_BRANDS_ORDERING.md) for comprehensive manual ordering documentation including:
- API reference
- Examples
- Best practices
- Database schema

---

## Quick Reference

### Common API Patterns

**Get Top Content (Manual + Auto-Scored)**:
```
GET /api/admin/dashboard/top-brands
GET /api/admin/dashboard/top-influencers
GET /api/admin/dashboard/top-campaigns
```

**Get All Content (With Filters)**:
```
GET /api/admin/brands?profileFilter=topProfile
GET /api/admin/influencers?profileFilter=verifiedProfile
```

**Manual Ordering**:
```
PUT /api/admin/influencer/:id/top-status
PUT /api/admin/influencer/:id/display-order
PUT /api/admin/brand/:id/top-status
PUT /api/admin/brand/:id/display-order
```

**Push Notifications**:
```
POST /api/admin/push-notifications          # Create
GET /api/admin/push-notifications           # List
GET /api/admin/push-notifications/:id       # Get details
PUT /api/admin/push-notifications/:id       # Update
POST /api/admin/push-notifications/:id/send # Send
DELETE /api/admin/push-notifications/:id    # Delete (draft only)
```

---

## Support

For questions or issues:
- Review this documentation
- Check Swagger API docs at `/api/docs`
- Contact development team

**Last Updated**: October 31, 2025
**Version**: 1.0
