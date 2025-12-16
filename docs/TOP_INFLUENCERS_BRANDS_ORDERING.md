# Top Influencers & Brands - Manual Ordering System

## Overview

This document explains how to manage the ordering of top influencers and top brands in the system. The feature allows admins to manually control which influencers/brands appear in the "Top" lists and their display order.

---

## Key Concepts

### 1. **Top Status Flag**
- **`isTopInfluencer`** (for influencers)
- **`isTopBrand`** (for brands)

**Purpose**: Controls whether an influencer/brand appears in the "Top" list at all.

- `true` = Appears in top list
- `false` = Does NOT appear in top list (even if they have great metrics)

### 2. **Display Order**
- **`displayOrder`** (number, 1-1000, or `null`)

**Purpose**: Manual positioning within the top list.

- **Lower number = Higher priority** (e.g., `1` appears first)
- **`null`** = Use automatic scoring to determine position
- Can coexist: Some top influencers/brands with manual order, others with automatic scoring

---

## Workflow

### **Step 1: Mark as Top Influencer/Brand**

Before an influencer or brand can appear in the top list, they must be marked as "top" by an admin.

#### **API Endpoints:**

**Mark Influencer as Top:**
```http
PUT /api/admin/influencer/:influencerId/top-status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "isTopInfluencer": true
}
```

**Mark Brand as Top:**
```http
PUT /api/admin/brand/:brandId/top-status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "isTopBrand": true
}
```

**Response:**
```json
{
  "message": "Influencer marked as top influencer",
  "influencerId": 123,
  "isTopInfluencer": true,
  "updatedBy": 1,
  "updatedAt": "2025-10-29T10:30:00Z"
}
```

---

### **Step 2: Set Display Order (Optional)**

Once marked as "top", you can optionally set a manual display order.

#### **API Endpoints:**

**Set Influencer Display Order:**
```http
PUT /api/admin/influencer/:influencerId/display-order
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "displayOrder": 1
}
```

**Set Brand Display Order:**
```http
PUT /api/admin/brand/:brandId/display-order
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "displayOrder": 5
}
```

**Response:**
```json
{
  "message": "Influencer display order set to 1",
  "influencerId": 123,
  "displayOrder": 1,
  "updatedBy": 1,
  "updatedAt": "2025-10-29T10:30:00Z"
}
```

---

### **Step 3: Remove Manual Order (Return to Auto-Scoring)**

To remove manual ordering and let the system use automatic scoring:

```http
PUT /api/admin/influencer/:influencerId/display-order
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "displayOrder": null
}
```

**Response:**
```json
{
  "message": "Influencer display order removed (will use automatic scoring)",
  "influencerId": 123,
  "displayOrder": null,
  "updatedBy": 1,
  "updatedAt": "2025-10-29T10:30:00Z"
}
```

---

## Sorting Logic

### **How Ordering Works:**

When fetching top influencers/brands, the system uses this priority:

1. **Manually ordered items first** (sorted by `displayOrder` ASC: 1, 2, 3...)
2. **Auto-scored items second** (sorted by composite score DESC: highest score first)

### **Example:**

Assume you have 10 top influencers:

| Influencer | isTopInfluencer | displayOrder | Composite Score |
|------------|-----------------|--------------|-----------------|
| Alice      | true            | 1            | 75              |
| Bob        | true            | 2            | 82              |
| Charlie    | true            | null         | 95              |
| Diana      | true            | null         | 88              |
| Eve        | true            | null         | 92              |

**Result order:**
1. **Alice** (displayOrder = 1)
2. **Bob** (displayOrder = 2)
3. **Charlie** (score = 95)
4. **Eve** (score = 92)
5. **Diana** (score = 88)

---

## Use Cases

### **Use Case 1: Promote a New Influencer**

You have a promising new influencer with low metrics but great potential.

```bash
# Step 1: Mark as top
PUT /api/admin/influencer/456/top-status
{ "isTopInfluencer": true }

# Step 2: Set to position 1 (appears first)
PUT /api/admin/influencer/456/display-order
{ "displayOrder": 1 }
```

✅ **Result**: New influencer appears at the top, even with low score.

---

### **Use Case 2: Reorder Existing Top Influencers**

Current order (by score):
1. Alice (score 95)
2. Bob (score 92)
3. Charlie (score 88)

You want Bob to appear first:

```bash
# Set Bob to position 1
PUT /api/admin/influencer/2/display-order
{ "displayOrder": 1 }

# Alice and Charlie remain auto-scored
```

✅ **New order**:
1. Bob (displayOrder = 1)
2. Alice (score 95)
3. Charlie (score 88)

---

### **Use Case 3: Move 4th Position to 1st**

Current state:
1. Alice (displayOrder = 1)
2. Bob (displayOrder = 2)
3. Charlie (displayOrder = 3)
4. Diana (displayOrder = 4)

Move Diana to 1st:

```bash
# Option A: Update all positions
PUT /api/admin/influencer/456/display-order
{ "displayOrder": 1 }  # Diana

PUT /api/admin/influencer/123/display-order
{ "displayOrder": 2 }  # Alice

PUT /api/admin/influencer/234/display-order
{ "displayOrder": 3 }  # Bob

PUT /api/admin/influencer/345/display-order
{ "displayOrder": 4 }  # Charlie
```

**OR**

```bash
# Option B: Just set Diana to 1, others keep their numbers
PUT /api/admin/influencer/456/display-order
{ "displayOrder": 1 }  # Diana

# Result: Diana (1), Alice (1 - conflict, uses creation order), Bob (2), Charlie (3)
# Note: For clean ordering, update all positions
```

---

## Best Practices

### ✅ **DO:**
- Mark influencers/brands as "top" before setting display order
- Use sequential numbers (1, 2, 3, 4...) for clean ordering
- Leave most influencers/brands on auto-scoring (displayOrder = null)
- Only manually order the top 3-5 items for featured placement

### ❌ **DON'T:**
- Set display order without marking as top first (it won't appear in list)
- Use display order > 1000 (validation will fail)
- Rely solely on manual ordering (defeats the purpose of the scoring algorithm)

---

## Fetching Top Lists

### **Get Top Influencers:**
```http
GET /api/admin/top-influencers?limit=20
Authorization: Bearer <admin-token>
```

**Response includes `displayOrder` field:**
```json
{
  "influencers": [
    {
      "id": 123,
      "name": "Alice",
      "displayOrder": 1,
      "scoreBreakdown": { "overallScore": 75 }
    },
    {
      "id": 456,
      "name": "Bob",
      "displayOrder": 2,
      "scoreBreakdown": { "overallScore": 82 }
    },
    {
      "id": 789,
      "name": "Charlie",
      "displayOrder": null,
      "scoreBreakdown": { "overallScore": 95 }
    }
  ]
}
```

### **Get Top Brands:**
```http
GET /api/admin/top-brands?limit=20
Authorization: Bearer <admin-token>
```

---

## Database Schema

### **Migration:**
```sql
-- Add displayOrder columns
ALTER TABLE influencers ADD COLUMN "displayOrder" INTEGER NULL;
ALTER TABLE brands ADD COLUMN "displayOrder" INTEGER NULL;

-- Add indexes
CREATE INDEX idx_influencers_display_order ON influencers("displayOrder") 
  WHERE "displayOrder" IS NOT NULL;
CREATE INDEX idx_brands_display_order ON brands("displayOrder") 
  WHERE "displayOrder" IS NOT NULL;
```

### **Run Migration:**
```bash
psql -U <username> -d <database> -f migrations/add_display_order_to_influencers_and_brands.sql
```

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/influencer/:id/top-status` | PUT | Mark/unmark as top influencer |
| `/api/admin/brand/:id/top-status` | PUT | Mark/unmark as top brand |
| `/api/admin/influencer/:id/display-order` | PUT | Set manual display order |
| `/api/admin/brand/:id/display-order` | PUT | Set manual display order |
| `/api/admin/top-influencers` | GET | Fetch top influencers (respects order) |
| `/api/admin/top-brands` | GET | Fetch top brands (respects order) |

---

## Questions?

Contact the development team for assistance with manual ordering implementation.
