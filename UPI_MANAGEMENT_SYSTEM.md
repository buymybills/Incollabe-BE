# UPI Management System - Complete Implementation

## Overview
Implemented a sophisticated UPI ID management system that allows influencers to manage multiple UPI IDs, track redemption history, and select which UPI to use for each transaction.

## Database Schema

### New Table: `influencer_upi_ids`
```sql
CREATE TABLE influencer_upi_ids (
  id SERIAL PRIMARY KEY,
  influencerId INTEGER NOT NULL REFERENCES influencers(id),
  upiId VARCHAR(255) NOT NULL,
  isSelectedForCurrentTransaction BOOLEAN DEFAULT false,
  lastUsedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),

  UNIQUE(influencerId, upiId)
);
```

**Key Features:**
- Stores multiple UPI IDs per influencer
- Tracks which UPI is selected for current redemption
- Records when each UPI was last used
- Prevents duplicate UPI IDs for same influencer

## API Endpoints

### 1. Get All UPI IDs
**GET** `/api/influencer/upi-ids`

**Response:**
```json
{
  "success": true,
  "data": {
    "upiIds": [
      {
        "id": 1,
        "upiId": "9876543210@paytm",
        "isSelectedForCurrentTransaction": true,  // Only included when true
        "lastUsedAt": "2025-11-25T10:00:00.000Z",
        "createdAt": "2025-11-20T10:00:00.000Z"
      },
      {
        "id": 2,
        "upiId": "user@oksbi",
        // No isSelectedForCurrentTransaction field (it's false)
        "lastUsedAt": "2025-11-20T08:00:00.000Z",
        "createdAt": "2025-11-15T10:00:00.000Z"
      }
    ],
    "total": 2
  }
}
```

**Note:** The `isSelectedForCurrentTransaction` field is only included when it's `true`. If it's not present, it means the UPI is not selected.

**Ordering:**
1. Selected UPI first
2. Then by last used date (most recent first)
3. Then by creation date (newest first)

### 2. Add New UPI ID
**POST** `/api/influencer/upi-ids`

**Request Body:**
```json
{
  "upiId": "9876543210@paytm",
  "setAsSelected": true  // optional, default: false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "influencerId": 132,
    "upiId": "9876543210@paytm",
    "isSelectedForCurrentTransaction": true,
    "lastUsedAt": null,
    "createdAt": "2025-11-28T10:00:00.000Z",
    "updatedAt": "2025-11-28T10:00:00.000Z"
  }
}
```

**Validation:**
- Checks if UPI already exists for influencer
- If `setAsSelected = true`, unselects all other UPIs

### 3. Select UPI for Transaction
**PUT** `/api/influencer/upi-ids/select`

**Request Body:**
```json
{
  "upiIdRecordId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "UPI ID selected successfully",
    "upiId": "9876543210@paytm"
  }
}
```

**Behavior:**
- Unselects all other UPIs for the influencer
- Selects the specified UPI
- Validates UPI belongs to the influencer

### 4. Delete UPI ID
**DELETE** `/api/influencer/upi-ids/:upiIdRecordId`

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "UPI ID deleted successfully"
  }
}
```

**Validation:**
- Cannot delete if it's the only UPI and there are pending transactions
- Validates UPI belongs to the influencer

### 5. Redeem Rewards (Updated)
**POST** `/api/influencer/redeem-rewards`

**Request Body (Optional):**
```json
{
  "upiIdRecordId": 1  // optional, uses selected UPI if not provided
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Redemption request submitted successfully. You will receive the payment within 24-48 hours.",
    "amountRequested": 200,
    "upiId": "9876543210@paytm",
    "transactionsProcessed": 2
  }
}
```

**Behavior:**
1. Uses `upiIdRecordId` if provided, otherwise uses selected UPI
2. Validates UPI exists and belongs to influencer
3. Updates all pending transactions to `processing` status
4. Updates `lastUsedAt` timestamp for the UPI
5. Sends WhatsApp notification

## Migration Steps

### 1. Run Migration
```bash
psql -U your_user -d your_database -f migrations/create_influencer_upi_ids_table.sql
```

### 2. Migrate Existing Data (Optional)
```sql
-- Copy existing UPI IDs from influencers table to new table
INSERT INTO influencer_upi_ids ("influencerId", "upiId", "isSelectedForCurrentTransaction", "createdAt", "updatedAt")
SELECT
  id as "influencerId",
  "upiId",
  true as "isSelectedForCurrentTransaction",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM influencers
WHERE "upiId" IS NOT NULL AND "upiId" != '';
```

## Frontend Integration

### Redeem Page Flow

1. **Load Page:**
   ```javascript
   // Fetch all UPI IDs
   const response = await fetch('/api/influencer/upi-ids', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const { upiIds } = await response.json();

   // UPIs are already sorted (selected first, then by last used)
   ```

2. **Display UPI Options:**
   - Show UPIs in order received from API
   - Highlight the selected UPI
   - Show "Last used" timestamp for each

3. **Add New UPI:**
   ```javascript
   await fetch('/api/influencer/upi-ids', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       upiId: "9876543210@paytm",
       setAsSelected: true
     })
   });
   ```

4. **Select UPI:**
   ```javascript
   await fetch('/api/influencer/upi-ids/select', {
     method: 'PUT',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       upiIdRecordId: selectedUpiId
     })
   });
   ```

5. **Redeem:**
   ```javascript
   // Option 1: Use selected UPI
   await fetch('/api/influencer/redeem-rewards', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({})
   });

   // Option 2: Use specific UPI
   await fetch('/api/influencer/redeem-rewards', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({
       upiIdRecordId: 1
     })
   });
   ```

## Admin View

Admins can see redemption history from `credit_transactions` table:

```sql
SELECT
  ct.id,
  ct."influencerId",
  i.name as "influencerName",
  ct.amount,
  ct."upiId",
  ct."paymentStatus",
  ct."createdAt" as "requestedAt",
  ct."paidAt"
FROM credit_transactions ct
JOIN influencers i ON i.id = ct."influencerId"
WHERE ct."paymentStatus" = 'processing'
ORDER BY ct."createdAt" DESC;
```

## Important Changes from Old System

### ⚠️ Deprecated: UPI ID in Profile API

**OLD WAY (Deprecated):**
```
PUT /api/influencer/profile
Body: { "upiId": "9876543210@paytm" }
```

**NEW WAY:**
```
POST /api/influencer/upi-ids
Body: { "upiId": "9876543210@paytm", "setAsSelected": true }
```

**What Changed:**
- ❌ **Removed**: `upiId` field from `PUT /api/influencer/profile`
- ✅ **New**: Dedicated UPI management endpoints (`/upi-ids`)
- ℹ️ **Note**: Old `upiId` field still exists in influencer table for backward compatibility
- ℹ️ **GET Profile**: Will still return `upiId` (for backward compat), but shows the old single UPI value
- ⚡ **Recommendation**: Use new UPI management APIs for all UPI operations

## Benefits

1. **Multiple UPI Support**: Influencers can maintain multiple UPI IDs
2. **Transaction Tracking**: Each redemption is linked to specific UPI used
3. **Usage History**: `lastUsedAt` shows when each UPI was last used
4. **Smart Ordering**: UPIs are automatically sorted (selected → most recent → newest)
5. **Data Integrity**: Unique constraints prevent duplicate UPIs
6. **Validation**: Cannot delete only UPI if pending transactions exist
7. **Audit Trail**: Complete history of which UPI was used for each redemption
8. **Separation of Concerns**: UPI management separate from profile updates

## Testing

### Test Scenarios

1. **Add First UPI:**
   - Should automatically select it if `setAsSelected = true`

2. **Add Second UPI:**
   - First UPI should remain selected
   - Can manually select second UPI

3. **Redeem with Selected UPI:**
   - Should use selected UPI
   - Updates `lastUsedAt`

4. **Delete UPI:**
   - Can delete non-selected UPI freely
   - Cannot delete only UPI with pending transactions

5. **Order Verification:**
   - Selected UPI always appears first
   - Then sorted by last used date
   - Then by creation date
