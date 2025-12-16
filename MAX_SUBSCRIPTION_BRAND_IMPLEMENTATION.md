# Max Subscription - Brand Admin APIs Implementation

**Feature**: Admin panel for managing Brand Max Campaign purchases
**Date**: December 16, 2025
**Status**: ✅ Implementation Complete

---

## 📋 Overview

Created admin-side APIs for the "Maxx Subscription - Brand" feature to manage and monitor brand purchases of Max Campaigns (unlimited influencer invitations).

---

## 🎯 Implemented APIs

### 1. **GET /api/admin/max-subscription-brand/statistics**

**Purpose**: Get comprehensive Max Campaign Brand statistics with month-over-month growth

**Authentication**: Required (Admin JWT)

**Response**:
```json
{
  "totalMaxxProfile": 200,
  "totalMaxxProfileGrowth": 36.0,
  "activeMaxxProfiles": 100,
  "activeMaxxProfilesGrowth": -2.9,
  "inactiveMaxxProfiles": 100,
  "inactiveMaxxProfilesGrowth": -2.9,
  "subscriptionCancelled": 20,
  "subscriptionCancelledGrowth": -2.9
}
```

**What it calculates**:
- **Total Maxx Profile**: Count of all paid Max Campaign invoices
- **Active Maxx Profiles**: Campaigns that are active/ongoing
- **Inactive Maxx Profiles**: Campaigns that are completed/closed
- **Subscription Cancelled**: Campaigns that have been cancelled
- All values include month-over-month growth percentages

---

### 2. **GET /api/admin/max-subscription-brand/purchases**

**Purpose**: Get paginated list of Max Campaign purchases with filters

**Authentication**: Required (Admin JWT)

**Query Parameters**:
```typescript
{
  page?: number;              // Default: 1
  limit?: number;             // Default: 20
  purchaseType?: 'all' | 'invite_campaign' | 'maxx_campaign';  // For tabs
  status?: 'all' | 'active' | 'inactive' | 'cancelled';
  search?: string;            // Search by brand name, username, campaign name
  startDate?: string;         // Filter by date (YYYY-MM-DD)
  endDate?: string;           // Filter by date (YYYY-MM-DD)
  sortBy?: 'createdAt' | 'amount';  // Default: 'createdAt'
  sortOrder?: 'ASC' | 'DESC';       // Default: 'DESC'
}
```

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "campaignId": 5,
      "brandName": "Sneha Shah",
      "username": "@sneha_s19",
      "campaignName": "Glow Like Never Before",
      "maxxType": "Maxx Campaign",
      "amount": 499,
      "purchaseDateTime": "11:59 PM | Oct 02, 2025",
      "status": "active",
      "invoiceNumber": "INV-202510-00123",
      "paymentMethod": "razorpay"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 200,
    "totalPages": 10
  }
}
```

**Tab Mapping**:
- **All Maxx Purchases**: `purchaseType=all`
- **Invite campaign**: `purchaseType=invite_campaign`
- **Maxx Campaign**: `purchaseType=maxx_campaign`

---

## 📁 Files Created

### 1. DTOs
**File**: `src/admin/dto/max-subscription-brand.dto.ts`

Created DTOs:
- `MaxSubscriptionBrandStatisticsDto` - Statistics response
- `GetMaxPurchasesDto` - List query parameters
- `MaxPurchaseItemDto` - Single purchase item
- `MaxPurchasesResponseDto` - List response with pagination
- `MaxPurchaseTypeFilter` - Enum for purchase type tabs
- `MaxCampaignStatusFilter` - Enum for status filter

### 2. Service
**File**: `src/admin/services/max-subscription-brand.service.ts`

Implemented methods:
- `getStatistics()` - Get statistics with MoM growth
- `getMaxPurchases(filters)` - Get paginated list with filters

### 3. Controller Endpoints
**File**: `src/admin/admin.controller.ts`

Added endpoints:
- `GET /max-subscription-brand/statistics`
- `GET /max-subscription-brand/purchases`

### 4. Module Registration
**File**: `src/admin/admin.module.ts`

Added:
- MaxCampaignInvoice model import
- MaxSubscriptionBrandService provider
- Service injection in controller

---

## 🔍 How It Works

### Statistics Calculation

1. **Total Maxx Profile**: Counts all `max_campaign_invoices` with `paymentStatus = 'paid'`

2. **Active Maxx Profiles**: Counts invoices where the associated campaign has `status IN ('active', 'ongoing')` and `isMaxCampaign = true`

3. **Inactive Maxx Profiles**: Counts invoices where campaign has `status IN ('completed', 'closed')`

4. **Subscription Cancelled**: Counts invoices where campaign has `status = 'cancelled'`

5. **Growth Calculation**: Compares current month vs previous month data

### Purchases List

1. Queries `max_campaign_invoices` table with `paymentStatus = 'paid'`
2. Joins with `campaigns` table to get campaign details
3. Joins with `brands` table to get brand information
4. Applies filters for status, purchase type, search, and date range
5. Supports sorting by date or amount
6. Returns paginated results

---

## 🎨 Frontend Integration

### Statistics Cards
```typescript
// API Call
GET /api/admin/max-subscription-brand/statistics

// UI Mapping
- TOTAL MAXX PROFILE → totalMaxxProfile
- ACTIVE MAXX PROFILES → activeMaxxProfiles
- INACTIVE MAXX PROFILES → inactiveMaxxProfiles
- SUBSCRIPTION CANCELLED → subscriptionCancelled
```

### Tab Implementation
```typescript
// All Maxx Purchases Tab
GET /api/admin/max-subscription-brand/purchases?purchaseType=all

// Invite campaign Tab
GET /api/admin/max-subscription-brand/purchases?purchaseType=invite_campaign

// Maxx Campaign Tab
GET /api/admin/max-subscription-brand/purchases?purchaseType=maxx_campaign
```

### Search & Filters
```typescript
// Search by brand name, username, or campaign name
GET /api/admin/max-subscription-brand/purchases?search=Sneha

// Filter by status
GET /api/admin/max-subscription-brand/purchases?status=active

// Filter by date range
GET /api/admin/max-subscription-brand/purchases?startDate=2025-10-01&endDate=2025-10-31

// Sort by amount descending
GET /api/admin/max-subscription-brand/purchases?sortBy=amount&sortOrder=DESC
```

---

## 📊 Database Tables Used

1. **`max_campaign_invoices`**
   - Stores payment information for Max Campaign purchases
   - Fields: id, invoiceNumber, campaignId, brandId, amount, paymentStatus, paymentMethod, paidAt, etc.

2. **`campaigns`**
   - Campaign details
   - Fields: id, name, status, isMaxCampaign, brandId

3. **`brands`**
   - Brand information
   - Fields: id, brandName, username

---

## 🔐 Security

- All endpoints require Admin JWT authentication (`@UseGuards(AdminAuthGuard)`)
- Protected with `@ApiBearerAuth()` decorator
- Returns 401 Unauthorized if not authenticated

---

## ⚠️ TODO / Notes

1. **Purchase Type Differentiation**: Currently, the service assumes all Max Campaigns are of type "Maxx Campaign". You may need to add a field to the `campaigns` table to distinguish between:
   - Campaigns created via invite (`Invite Campaign`)
   - Campaigns upgraded to Max directly (`Maxx Campaign`)

2. **Suggested Database Field**: Add a field like `createdViaInvite` (boolean) or `maxCampaignSource` (enum) to the `campaigns` table to enable proper filtering between the two tab types.

3. **Update Service Logic**: Once the differentiation field is added, update lines 260-269 in `max-subscription-brand.service.ts` to use the actual field instead of the TODO placeholders.

---

## ✅ Testing

### Test Statistics API
```bash
curl -X GET "http://localhost:3000/api/admin/max-subscription-brand/statistics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Test Purchases List API
```bash
# Get all purchases
curl -X GET "http://localhost:3000/api/admin/max-subscription-brand/purchases" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# With filters
curl -X GET "http://localhost:3000/api/admin/max-subscription-brand/purchases?status=active&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Search
curl -X GET "http://localhost:3000/api/admin/max-subscription-brand/purchases?search=Sneha" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🚀 Next Steps

1. **Restart the server** to load the new APIs
2. **Run the migration** if `referral_invite_click_count` column hasn't been added yet (from previous task)
3. **Test the APIs** using the curl commands above or Swagger UI
4. **Integrate with frontend** using the documented endpoints and parameters
5. **Add purchase type field** to campaigns table if you want to differentiate between Invite Campaign and Maxx Campaign tabs

---

**Implementation Complete** ✅
