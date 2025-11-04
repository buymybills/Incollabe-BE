# Campaign Admin API Documentation

## Overview

The Campaign Admin API provides endpoints for administrators to view, filter, search, and sort campaigns similar to how influencers and brands are managed.

---

## Endpoint

```
GET /api/admin/campaigns
```

**Authentication Required:** Yes (Admin Bearer Token)

---

## Campaign Filters

### Available Filters:

| Filter | Description |
|--------|-------------|
| `allCampaigns` | All campaigns regardless of status |
| `activeCampaigns` | Only active campaigns |
| `draftCampaigns` | Campaigns in draft status |
| `completedCampaigns` | Completed campaigns |
| `pausedCampaigns` | Paused campaigns |
| `cancelledCampaigns` | Cancelled campaigns |

---

## Query Parameters

### Required Parameters:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `campaignFilter` | enum | Campaign filter type (required) | `allCampaigns` |

### Optional Search Parameters:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `searchQuery` | string | Search by campaign name/title | `"Summer Fashion"` |
| `brandSearch` | string | Filter by brand name or username | `"Nike"` |
| `locationSearch` | string | Filter by city name | `"Mumbai"` |
| `nicheSearch` | string | Filter by niche name | `"Fashion"` |
| `campaignType` | enum | Filter by campaign type | `paid` or `barter` |

### Sorting Parameters:

| Parameter | Type | Description | Default | Options |
|-----------|------|-------------|---------|---------|
| `sortBy` | enum | Sort campaigns by metric | `createdAt` | `createdAt`, `applications`, `title` |

### Pagination Parameters:

| Parameter | Type | Description | Default | Validation |
|-----------|------|-------------|---------|------------|
| `page` | number | Page number | `1` | Min: 1 |
| `limit` | number | Results per page | `20` | Min: 1 |

---

## Response Format

```json
{
  "campaigns": [
    {
      "id": 1,
      "name": "Summer Fashion Campaign",
      "description": "Promoting summer collection 2025",
      "type": "paid",
      "status": "active",
      "category": "Fashion",
      "isInviteOnly": false,
      "isPanIndia": true,
      "createdAt": "2025-10-15T10:30:00.000Z",
      "brand": {
        "id": 5,
        "brandName": "Nike",
        "username": "nike_official"
      },
      "niches": ["Fashion", "Lifestyle", "Sports"],
      "cities": ["Mumbai", "Delhi", "Bangalore"],
      "applicationsCount": 150,
      "selectedCount": 10
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Response Fields:

| Field | Type | Description |
|-------|------|-------------|
| `campaigns` | array | Array of campaign objects |
| `total` | number | Total number of campaigns matching filters |
| `page` | number | Current page number |
| `limit` | number | Number of results per page |
| `totalPages` | number | Total number of pages |

### Campaign Object Fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Campaign ID |
| `name` | string | Campaign name/title |
| `description` | string | Campaign description |
| `type` | enum | Campaign type (`paid` or `barter`) |
| `status` | enum | Campaign status |
| `category` | string | Campaign category |
| `isInviteOnly` | boolean | Whether campaign is invite-only |
| `isPanIndia` | boolean | Whether campaign is Pan India |
| `createdAt` | string | Campaign creation timestamp |
| `brand` | object | Brand information |
| `niches` | array | Array of niche names |
| `cities` | array | Array of city names |
| `applicationsCount` | number | Total number of applications |
| `selectedCount` | number | Number of selected influencers |

---

## Usage Examples

### 1. Get All Campaigns

```http
GET /api/admin/campaigns?campaignFilter=allCampaigns&page=1&limit=20
```

### 2. Get Active Campaigns Only

```http
GET /api/admin/campaigns?campaignFilter=activeCampaigns
```

### 3. Search Campaigns by Name

```http
GET /api/admin/campaigns?campaignFilter=allCampaigns&searchQuery=Fashion
```

### 4. Filter by Brand

```http
GET /api/admin/campaigns?campaignFilter=allCampaigns&brandSearch=Nike
```

### 5. Filter by Location and Niche

```http
GET /api/admin/campaigns?campaignFilter=activeCampaigns&locationSearch=Mumbai&nicheSearch=Fashion
```

### 6. Sort by Applications

```http
GET /api/admin/campaigns?campaignFilter=allCampaigns&sortBy=applications
```

### 7. Filter by Campaign Type (Paid vs Barter)

```http
GET /api/admin/campaigns?campaignFilter=activeCampaigns&campaignType=paid
```

### 8. Get Completed Campaigns Sorted by Title

```http
GET /api/admin/campaigns?campaignFilter=completedCampaigns&sortBy=title
```

---

## Campaign Status Types

| Status | Description |
|--------|-------------|
| `draft` | Campaign is in draft mode |
| `active` | Campaign is live and accepting applications |
| `paused` | Campaign is temporarily paused |
| `completed` | Campaign has ended successfully |
| `cancelled` | Campaign has been cancelled |

---

## Campaign Types

| Type | Description |
|------|-------------|
| `paid` | Monetary compensation campaign |
| `barter` | Product/service exchange campaign |

---

## Sorting Options

### 1. **createdAt** (Default)
Sorts campaigns by creation date, newest first.

### 2. **applications**
Sorts campaigns by total number of applications received, highest first.

### 3. **title**
Sorts campaigns alphabetically by campaign name.

---

## Filters Behavior

### Status-Based Filters:
- **allCampaigns**: No status filter applied - shows all campaigns
- **activeCampaigns**: `status = 'active'`
- **draftCampaigns**: `status = 'draft'`
- **completedCampaigns**: `status = 'completed'`
- **pausedCampaigns**: `status = 'paused'`
- **cancelledCampaigns**: `status = 'cancelled'`

### Search Filters:
- **searchQuery**: Case-insensitive partial match on campaign `name`
- **brandSearch**: Case-insensitive partial match on brand `brandName` or `username`
- **locationSearch**: Case-insensitive partial match on city `name`
- **nicheSearch**: Case-insensitive partial match on niche `name`

### Multiple Filters:
All filters can be combined. For example:
```http
GET /api/admin/campaigns?campaignFilter=activeCampaigns&brandSearch=Nike&nicheSearch=Fashion&locationSearch=Mumbai
```

This will return only **active campaigns** from **Nike** in the **Fashion** niche targeting **Mumbai**.

---

## Comparison with Influencer/Brand APIs

| Feature | Influencers API | Brands API | Campaigns API |
|---------|----------------|------------|---------------|
| **Profile Filters** | ✅ (all, top, verified, unverified) | ✅ (all, top, verified, unverified) | ✅ (all, active, draft, completed, paused, cancelled) |
| **Search by Name** | ✅ | ✅ | ✅ |
| **Location Filter** | ✅ | ✅ | ✅ |
| **Niche Filter** | ✅ | ✅ | ✅ |
| **Additional Filters** | Followers range | Campaigns launched | Brand search, Campaign type |
| **Sorting Options** | posts, followers, following, campaigns, createdAt | posts, followers, following, campaigns, createdAt | createdAt, applications, title |
| **Scoring** | ✅ (for topProfile) | ✅ (for topProfile) | ❌ (not implemented) |
| **Metrics Returned** | followers, posts, campaigns | followers, posts, campaigns | applications, selected |

---

## Database Queries

### Get All Campaigns:
```sql
SELECT * FROM campaigns ORDER BY "createdAt" DESC;
```

### Get Active Campaigns:
```sql
SELECT * FROM campaigns WHERE status = 'active' ORDER BY "createdAt" DESC;
```

### Get Campaigns by Brand:
```sql
SELECT c.* 
FROM campaigns c
JOIN brands b ON c."brandId" = b.id
WHERE b."brandName" ILIKE '%Nike%' OR b.username ILIKE '%Nike%'
ORDER BY c."createdAt" DESC;
```

### Count Applications per Campaign:
```sql
SELECT 
    c.id,
    c.name,
    COUNT(ca.id) as applications_count,
    COUNT(CASE WHEN ca.status = 'selected' THEN 1 END) as selected_count
FROM campaigns c
LEFT JOIN campaign_applications ca ON c.id = ca."campaignId"
GROUP BY c.id, c.name
ORDER BY applications_count DESC;
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["campaignFilter must be a valid enum value"],
  "error": "Bad Request"
}
```

---

## Implementation Notes

1. **No Budget/Date Fields**: The Campaign model currently doesn't have `budget`, `startDate`, or `endDate` fields, so these filters are not available.

2. **Applications Count**: Calculated dynamically by counting related `campaign_applications` records.

3. **Selected Count**: Counts applications with `status = 'selected'`.

4. **Pan India vs City-Specific**: Campaigns can be either Pan India (`isPanIndia = true`) or target specific cities.

5. **Invite-Only Campaigns**: Some campaigns are invite-only (`isInviteOnly = true`) and don't accept open applications.

---

## Related Endpoints

- `GET /api/admin/dashboard/top-campaigns` - Get top performing campaigns with scoring
- `GET /api/admin/influencers` - Get influencers with filters
- `GET /api/admin/brands` - Get brands with filters
- `GET /api/admin/dashboard/stats` - Dashboard statistics including campaign counts

---

*Last Updated: November 3, 2025*
