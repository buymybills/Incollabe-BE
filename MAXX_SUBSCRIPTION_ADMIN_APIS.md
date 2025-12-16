# Maxx Subscription Admin APIs - Specification

**Feature**: Admin panel for managing Maxx Campaign subscriptions
**Date**: December 13, 2025
**Status**: 📝 Specification Ready

---

## 📋 Overview

APIs for the "Maxx Subscription - Influencer" admin page to manage and monitor influencer subscriptions to the Maxx Campaign feature (unlimited campaigns).

---

## 🚀 Required APIs

### 1. **GET /admin/maxx-subscription/statistics**

**Purpose**: Get comprehensive Maxx subscription statistics with month-over-month growth

**Query Parameters**: None required (uses current month vs last month)

**Response**:
```json
{
  "totalMaxxProfiles": 200,
  "totalMaxxProfilesGrowth": 36.0,
  "activeMaxxProfiles": 100,
  "activeMaxxProfilesGrowth": -2.9,
  "inactiveMaxxProfiles": 100,
  "inactiveMaxxProfilesGrowth": -2.9,
  "subscriptionCancelled": 20,
  "subscriptionCancelledGrowth": -2.9,
  "averageUsageDuration": 3.5,
  "averageUsageDurationGrowth": 36.0,
  "autopaySubscriptionCount": 100,
  "autopaySubscriptionCountGrowth": -2.9
}
```

**Authentication**: Required (Admin JWT)

**Description**:
- Total Maxx Profiles: Count of all influencers who have/had Maxx subscription
- Active Maxx Profiles: Currently active subscriptions
- Inactive Maxx Profiles: Expired or inactive subscriptions
- Subscription Cancelled: Cancelled subscriptions count
- Average Usage Duration: Average months of subscription usage
- Autopay Subscription Count: Subscriptions using autopay

---

### 2. **GET /admin/maxx-subscription/subscriptions**

**Purpose**: Get paginated list of Maxx subscriptions with filters

**Query Parameters**:
```typescript
{
  page?: number;              // Default: 1
  limit?: number;             // Default: 20
  profileStatus?: 'all' | 'active' | 'inactive' | 'cancelled' | 'paused';
  paymentType?: 'monthly' | 'autopay';
  search?: string;            // Search by name, username, location
  sortBy?: 'usageMonths' | 'validTill' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  startDate?: string;         // Filter by subscription start date
  endDate?: string;           // Filter by subscription end date
}
```

**Response**:
```json
{
  "data": [
    {
      "id": 123,
      "influencerId": 456,
      "profileName": "Sneha Shah",
      "username": "@sneha_s19",
      "location": "Navi Mumbai",
      "profileStatus": "active",
      "usageMonths": 4,
      "paymentType": "autopay",
      "validTillDate": "2025-10-02T23:59:00.000Z",
      "subscriptionStartDate": "2025-06-02T12:00:00.000Z",
      "lastPaymentDate": "2025-09-02T14:30:00.000Z",
      "nextBillingDate": "2025-10-02T00:00:00.000Z",
      "razorpaySubscriptionId": "sub_MNpJx1234567890",
      "profileImage": "https://...",
      "isAutoRenew": true
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

**Authentication**: Required (Admin JWT)

**Tab Mapping**:
- All Maxx Profiles: `profileStatus=all`
- Active Profile: `profileStatus=active`
- Inactive Profile: `profileStatus=inactive`
- Cancelled Subscription: `profileStatus=cancelled`
- Paused Subscription: `profileStatus=paused`

---

### 3. **GET /admin/maxx-subscription/subscriptions/:id**

**Purpose**: Get detailed information about a specific subscription

**Path Parameters**:
- `id`: Subscription ID

**Response**:
```json
{
  "id": 123,
  "influencerId": 456,
  "influencer": {
    "id": 456,
    "name": "Sneha Shah",
    "username": "@sneha_s19",
    "email": "sneha@example.com",
    "phone": "+919876543210",
    "location": "Navi Mumbai",
    "profileImage": "https://...",
    "isVerified": true
  },
  "subscriptionStatus": "active",
  "paymentType": "autopay",
  "razorpaySubscriptionId": "sub_MNpJx1234567890",
  "subscriptionStartDate": "2025-06-02T12:00:00.000Z",
  "subscriptionEndDate": "2025-10-02T23:59:00.000Z",
  "usageMonths": 4,
  "totalAmount": 796,
  "amountPerMonth": 199,
  "isAutoRenew": true,
  "nextBillingDate": "2025-10-02T00:00:00.000Z",
  "lastPaymentDate": "2025-09-02T14:30:00.000Z",
  "paymentHistory": [
    {
      "invoiceId": 789,
      "invoiceNumber": "INV-202509-00123",
      "amount": 199,
      "paymentDate": "2025-09-02T14:30:00.000Z",
      "paymentStatus": "paid",
      "razorpayPaymentId": "pay_ABC123"
    }
  ],
  "pauseHistory": [
    {
      "pausedAt": "2025-08-15T10:00:00.000Z",
      "resumedAt": "2025-08-20T12:00:00.000Z",
      "pauseDurationDays": 5,
      "reason": "User requested pause"
    }
  ],
  "cancellationDetails": null,
  "createdAt": "2025-06-02T12:00:00.000Z",
  "updatedAt": "2025-09-02T14:30:00.000Z"
}
```

**Authentication**: Required (Admin JWT)

---

### 4. **PUT /admin/maxx-subscription/subscriptions/:id/pause**

**Purpose**: Pause a Maxx subscription (admin action)

**Path Parameters**:
- `id`: Subscription ID

**Request Body**:
```json
{
  "reason": "Admin paused - payment issue",
  "adminNotes": "User requested pause due to financial constraints"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription paused successfully",
  "subscriptionId": 123,
  "pausedAt": "2025-10-13T10:30:00.000Z",
  "status": "paused"
}
```

**Authentication**: Required (Admin JWT)
**Authorization**: Super Admin, Content Moderator

---

### 5. **PUT /admin/maxx-subscription/subscriptions/:id/resume**

**Purpose**: Resume a paused Maxx subscription (admin action)

**Path Parameters**:
- `id`: Subscription ID

**Request Body**:
```json
{
  "adminNotes": "Issue resolved, resuming subscription"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription resumed successfully",
  "subscriptionId": 123,
  "resumedAt": "2025-10-13T11:00:00.000Z",
  "status": "active",
  "nextBillingDate": "2025-11-02T00:00:00.000Z"
}
```

**Authentication**: Required (Admin JWT)
**Authorization**: Super Admin, Content Moderator

---

### 6. **PUT /admin/maxx-subscription/subscriptions/:id/cancel**

**Purpose**: Cancel a Maxx subscription (admin action)

**Path Parameters**:
- `id`: Subscription ID

**Request Body**:
```json
{
  "reason": "Policy violation",
  "adminNotes": "Multiple complaints received",
  "refundAmount": 0,
  "immediateEffect": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "subscriptionId": 123,
  "cancelledAt": "2025-10-13T11:30:00.000Z",
  "status": "cancelled",
  "refundAmount": 0,
  "refundStatus": "not_applicable"
}
```

**Authentication**: Required (Admin JWT)
**Authorization**: Super Admin only

---

### 7. **GET /admin/maxx-subscription/revenue**

**Purpose**: Get revenue statistics for Maxx subscriptions

**Query Parameters**:
```typescript
{
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  groupBy?: 'day' | 'week' | 'month';  // Default: month
}
```

**Response**:
```json
{
  "totalRevenue": 39800,
  "totalRevenueGrowth": 15.5,
  "activeSubscriptions": 100,
  "newSubscriptionsThisMonth": 15,
  "cancelledThisMonth": 5,
  "churnRate": 5.0,
  "monthlyRecurringRevenue": 19900,
  "averageRevenuePerUser": 199,
  "revenueByMonth": [
    {
      "month": "2025-09",
      "revenue": 19900,
      "subscriptions": 100,
      "newSubscriptions": 10,
      "cancelled": 3
    },
    {
      "month": "2025-10",
      "revenue": 19900,
      "subscriptions": 100,
      "newSubscriptions": 5,
      "cancelled": 2
    }
  ]
}
```

**Authentication**: Required (Admin JWT)

---

### 8. **GET /admin/maxx-subscription/payment-failures**

**Purpose**: Get list of failed payment subscriptions that need attention

**Query Parameters**:
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: 'failureDate' | 'retryCount';
}
```

**Response**:
```json
{
  "data": [
    {
      "subscriptionId": 123,
      "influencerId": 456,
      "influencerName": "Sneha Shah",
      "username": "@sneha_s19",
      "lastPaymentAttempt": "2025-10-02T00:00:00.000Z",
      "failureReason": "Insufficient funds",
      "retryCount": 2,
      "nextRetryDate": "2025-10-05T00:00:00.000Z",
      "amount": 199,
      "subscriptionStatus": "active_with_issues"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

**Authentication**: Required (Admin JWT)

---

## 📊 Database Tables Required

Based on the existing codebase, these tables should already exist:

1. **`pro_subscriptions`** (or `maxx_subscriptions`)
   - Subscription details
   - Status tracking
   - Payment type
   - Start/end dates

2. **`pro_invoices`** (or `maxx_invoices`)
   - Payment history
   - Invoice details
   - Payment status

3. **`influencers`**
   - User details
   - Profile information

4. **`pro_payment_transactions`** (or `maxx_payment_transactions`)
   - Payment records
   - Transaction details

---

## 🎯 Implementation Priority

### Phase 1 (High Priority):
1. ✅ GET /admin/maxx-subscription/statistics
2. ✅ GET /admin/maxx-subscription/subscriptions
3. ✅ GET /admin/maxx-subscription/subscriptions/:id

### Phase 2 (Medium Priority):
4. ⏳ PUT /admin/maxx-subscription/subscriptions/:id/pause
5. ⏳ PUT /admin/maxx-subscription/subscriptions/:id/resume
6. ⏳ PUT /admin/maxx-subscription/subscriptions/:id/cancel

### Phase 3 (Low Priority):
7. ⏳ GET /admin/maxx-subscription/revenue
8. ⏳ GET /admin/maxx-subscription/payment-failures

---

## 🔐 Security & Authorization

| Endpoint | Required Role |
|----------|--------------|
| GET statistics | Admin (any role) |
| GET subscriptions | Admin (any role) |
| GET subscription/:id | Admin (any role) |
| PUT pause | Super Admin, Content Moderator |
| PUT resume | Super Admin, Content Moderator |
| PUT cancel | Super Admin only |
| GET revenue | Admin (any role) |
| GET payment-failures | Admin (any role) |

---

## 📝 Notes

- All endpoints should have pagination support
- Include proper error handling for invalid subscription IDs
- Log all admin actions (pause, resume, cancel) to audit logs
- Send notifications to influencers when subscriptions are paused/cancelled by admin
- Consider adding bulk operations for managing multiple subscriptions

---

## 🎨 Frontend Integration

The frontend should call these endpoints based on:

| UI Component | API Endpoint |
|-------------|--------------|
| Statistics Cards | `/admin/maxx-subscription/statistics` |
| All Maxx Profiles Tab | `/admin/maxx-subscription/subscriptions?profileStatus=all` |
| Active Profile Tab | `/admin/maxx-subscription/subscriptions?profileStatus=active` |
| Inactive Profile Tab | `/admin/maxx-subscription/subscriptions?profileStatus=inactive` |
| Cancelled Tab | `/admin/maxx-subscription/subscriptions?profileStatus=cancelled` |
| Paused Tab | `/admin/maxx-subscription/subscriptions?profileStatus=paused` |
| Action Buttons | PUT endpoints for pause/resume/cancel |

---

**Ready for Implementation** 🚀
