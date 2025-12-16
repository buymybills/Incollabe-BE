# Manual Ordering for Top Brands and Influencers

## Overview

This feature allows admins to manually control the display order of top brands and influencers, overriding the automatic scoring system when needed.

## How It Works

### Database Fields

Both `influencers` and `brands` tables now have a `displayOrder` field:
- **Type**: `INTEGER` (nullable)
- **Purpose**: Manual sort order (lower number = higher priority)
- **Default**: `NULL` (uses automatic scoring)

### Sorting Logic

When fetching top brands/influencers:

1. **Items with `displayOrder` set** are sorted first (lower number appears first)
2. **Items without `displayOrder`** (NULL) are sorted by automatic scoring
3. Within each group, secondary sorting applies

**Example:**
```
displayOrder: 1  → Influencer A  (shows first)
displayOrder: 2  → Influencer B  (shows second)
displayOrder: 5  → Influencer C  (shows third)
displayOrder: NULL → Influencer D (score: 95.5)  (shows fourth)
displayOrder: NULL → Influencer E (score: 92.3)  (shows fifth)
displayOrder: NULL → Influencer F (score: 88.1)  (shows sixth)
```

---

## Admin API Endpoints

### 1. Update Influencer Display Order

**Endpoint:** `PUT /api/admin/influencer/:influencerId/display-order`

**Auth:** Requires admin authentication + `SUPER_ADMIN` or `CONTENT_MODERATOR` role

**Request Body:**
```json
{
  "displayOrder": 1
}
```

**To remove manual ordering:**
```json
{
  "displayOrder": null
}
```

**Response:**
```json
{
  "message": "Influencer display order set to 1",
  "influencerId": 123,
  "displayOrder": 1,
  "updatedBy": 1,
  "updatedAt": "2025-10-29T10:30:00.000Z"
}
```

**Validation:**
- `displayOrder` must be between 1 and 1000, or `null`
- Throws 404 if influencer not found

---

### 2. Update Brand Display Order

**Endpoint:** `PUT /api/admin/brand/:brandId/display-order`

**Auth:** Requires admin authentication + `SUPER_ADMIN` or `CONTENT_MODERATOR` role

**Request Body:**
```json
{
  "displayOrder": 1
}
```

**To remove manual ordering:**
```json
{
  "displayOrder": null
}
```

**Response:**
```json
{
  "message": "Brand display order set to 1",
  "brandId": 456,
  "displayOrder": 1,
  "updatedBy": 1,
  "updatedAt": "2025-10-29T10:30:00.000Z"
}
```

**Validation:**
- `displayOrder` must be between 1 and 1000, or `null`
- Throws 404 if brand not found

---

## Use Cases

### Move 4th Item to 1st Position

**Scenario:** You have 10 top influencers ranked by score, and you want to move the 4th one to the top.

**Steps:**

1. **Fetch current top influencers:**
   ```
   GET /api/admin/top-influencers?limit=10
   ```

2. **Current result:**
   ```
   1. Influencer A (score: 98.5)
   2. Influencer B (score: 95.2)
   3. Influencer C (score: 92.8)
   4. Influencer D (score: 90.1) ← Move this to top
   5. Influencer E (score: 88.5)
   ...
   ```

3. **Set display order for Influencer D:**
   ```bash
   PUT /api/admin/influencer/{{influencer_d_id}}/display-order
   {
     "displayOrder": 1
   }
   ```

4. **New result:**
   ```
   1. Influencer D (displayOrder: 1) ← Now shows first!
   2. Influencer A (score: 98.5)
   3. Influencer B (score: 95.2)
   4. Influencer C (score: 92.8)
   5. Influencer E (score: 88.5)
   ...
   ```

---

### Reorder Multiple Items

**Scenario:** You want to create a custom top 3:

```bash
# Set first position
PUT /api/admin/influencer/789/display-order
{ "displayOrder": 1 }

# Set second position
PUT /api/admin/influencer/456/display-order
{ "displayOrder": 2 }

# Set third position
PUT /api/admin/influencer/123/display-order
{ "displayOrder": 3 }
```

**Result:**
```
1. Influencer 789 (displayOrder: 1)
2. Influencer 456 (displayOrder: 2)
3. Influencer 123 (displayOrder: 3)
4. Others sorted by automatic score...
```

---

### Remove Manual Ordering

**Scenario:** You want an influencer to go back to automatic scoring.

```bash
PUT /api/admin/influencer/789/display-order
{
  "displayOrder": null
}
```

The influencer will now be sorted based on their automatic score among other non-manually-ordered influencers.

---

## Migration

**Run the migration:**
```bash
psql -U your_username -d your_database -f migrations/add_display_order_to_influencers_and_brands.sql
```

**Migration adds:**
- `displayOrder` column to `influencers` table
- `displayOrder` column to `brands` table
- Indexes for performance
- Column comments for documentation

---

## API Response Changes

### Top Influencers Response

The `TopInfluencerDto` now includes:

```typescript
{
  "id": 123,
  "name": "John Doe",
  // ... other fields ...
  "displayOrder": 1,  // ← NEW FIELD (nullable)
  "scoreBreakdown": {
    "overallScore": 95.5
  }
}
```

### Top Brands Response

The `TopBrandDto` now includes:

```typescript
{
  "id": 456,
  "brandName": "Nike India",
  // ... other fields ...
  "displayOrder": 1,  // ← NEW FIELD (nullable)
  "metrics": {
    "compositeScore": 88.3
  }
}
```

---

## Best Practices

### 1. **Use Gaps in Numbering**
Instead of `1, 2, 3, 4...`, use `10, 20, 30, 40...`

**Why?** Makes it easier to insert items later without renumbering everything.

**Example:**
```
displayOrder: 10 → Influencer A
displayOrder: 20 → Influencer B
displayOrder: 30 → Influencer C
```

Now if you want to insert between A and B:
```
displayOrder: 15 → Influencer D  (no need to update B and C)
```

---

### 2. **Limit Manual Ordering**
Only set `displayOrder` for items you truly want to feature. Let others use automatic scoring.

**Example:**
- Set `displayOrder` for top 3-5 featured items
- Leave rest as `NULL` for automatic scoring

---

### 3. **Document Reasons**
Keep track of why you manually ordered certain items (marketing campaign, special partnership, etc.)

---

### 4. **Periodic Review**
Regularly review manually ordered items to ensure they still deserve their position.

---

## Frontend Integration

### Display Order Indicator

Show a badge or icon for manually ordered items:

```jsx
{influencer.displayOrder !== null && (
  <Badge variant="primary">
    Manually Featured #{influencer.displayOrder}
  </Badge>
)}
```

### Admin UI for Reordering

**Option 1: Drag-and-Drop**
```jsx
<DragDropList
  items={topInfluencers}
  onReorder={(newOrder) => {
    // Update displayOrder for each item
    newOrder.forEach((item, index) => {
      updateDisplayOrder(item.id, (index + 1) * 10);
    });
  }}
/>
```

**Option 2: Input Field**
```jsx
<input
  type="number"
  value={influencer.displayOrder || ''}
  onChange={(e) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    updateDisplayOrder(influencer.id, value);
  }}
  placeholder="Auto"
/>
```

---

## Testing

### Test Cases

1. **Set display order:**
   ```bash
   curl -X PUT http://localhost:3000/api/admin/influencer/1/display-order \
     -H "Authorization: Bearer {{admin_token}}" \
     -H "Content-Type: application/json" \
     -d '{"displayOrder": 1}'
   ```

2. **Remove display order:**
   ```bash
   curl -X PUT http://localhost:3000/api/admin/influencer/1/display-order \
     -H "Authorization: Bearer {{admin_token}}" \
     -H "Content-Type: application/json" \
     -d '{"displayOrder": null}'
   ```

3. **Verify sorting:**
   ```bash
   curl http://localhost:3000/api/admin/top-influencers?limit=20
   ```
   
   Verify that items with `displayOrder` appear first, sorted by their order value.

---

## Rollback

If you need to remove this feature:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_influencers_display_order;
DROP INDEX IF EXISTS idx_brands_display_order;

-- Remove columns
ALTER TABLE influencers DROP COLUMN IF EXISTS "displayOrder";
ALTER TABLE brands DROP COLUMN IF EXISTS "displayOrder";
```

---

## Summary

- ✅ **Manual control** over top items order
- ✅ **Flexible**: Can use for any subset of items
- ✅ **Reversible**: Set to `null` to use automatic scoring
- ✅ **Performant**: Indexed for fast queries
- ✅ **Simple API**: Just set a number or `null`
- ✅ **Backward compatible**: Existing items continue using automatic scoring

Perfect for featuring sponsored content, seasonal campaigns, or highlighting specific partnerships!
