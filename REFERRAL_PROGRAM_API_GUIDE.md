# Referral Program Admin API Guide

This guide covers the new Referral Program APIs for the admin panel.

## Overview

The Referral Program APIs provide comprehensive management of the referral system, including:
- Statistics with month-over-month growth
- New accounts created with referral codes
- Account referrers (influencers who referred others)
- Transaction history

## API Endpoints

### 1. Get Referral Program Statistics

**Endpoint:** `GET /admin/referral-program/statistics`

**Description:** Get comprehensive statistics for the referral program dashboard.

**Response Example:**
```json
{
  "totalReferralCodesGenerated": 3200,
  "totalReferralCodesGeneratedGrowth": 36.0,
  "accountsCreatedWithReferral": 1200,
  "accountsCreatedWithReferralGrowth": -2.9,
  "amountSpentInReferral": 120000,
  "amountSpentInReferralGrowth": -2.9,
  "redeemRequestsRaised": 32
}
```

**Swagger:** `/api-docs` → Admin → `GET /admin/referral-program/statistics`

---

### 2. Get New Accounts With Referral

**Endpoint:** `GET /admin/referral-program/new-accounts`

**Description:** Get paginated list of new accounts created using referral codes.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 20)
- `profileStatus` (optional): Filter by verification status (`all`, `verified`, `unverified`)
- `search` (optional): Search by profile name, username, or referral code
- `startDate` (optional): Filter from date (YYYY-MM-DD)
- `endDate` (optional): Filter to date (YYYY-MM-DD)

**Response Example:**
```json
{
  "data": [
    {
      "id": 123,
      "profileName": "Sneha Shah",
      "username": "@sneha_s19",
      "location": "Navi Mumbai",
      "profileStatus": "verified",
      "referredBy": "@john_doe",
      "referralCode": "JOHN123",
      "referralDate": "2025-10-02T12:28:00.000Z",
      "profileImage": "https://..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1200,
    "totalPages": 60
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/admin/referral-program/new-accounts?page=1&limit=20&profileStatus=verified" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Get Account Referrers

**Endpoint:** `GET /admin/referral-program/account-referrers`

**Description:** Get list of influencers who have referred others with their earnings and statistics.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 20)
- `search` (optional): Search by name, username, or referral code
- `sortBy` (optional): Sort field (`totalReferrals`, `totalEarnings`, `createdAt`)
- `sortOrder` (optional): Sort order (`ASC`, `DESC`)

**Response Example:**
```json
{
  "data": [
    {
      "id": 456,
      "profileName": "John Doe",
      "username": "@john_doe",
      "location": "Mumbai",
      "profileStatus": "verified",
      "referralCode": "JOHN123",
      "totalReferrals": 25,
      "totalEarnings": 2500,
      "redeemed": 1500,
      "pending": 1000,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "profileImage": "https://..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/admin/referral-program/account-referrers?sortBy=totalReferrals&sortOrder=DESC" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Get Referral Transactions

**Endpoint:** `GET /admin/referral-program/transactions`

**Description:** Get paginated list of referral bonus transactions.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 20)
- `paymentStatus` (optional): Filter by status (`pending`, `processing`, `paid`, `failed`, `cancelled`)
- `search` (optional): Search by influencer name or username
- `startDate` (optional): Filter from date (YYYY-MM-DD)
- `endDate` (optional): Filter to date (YYYY-MM-DD)

**Response Example:**
```json
{
  "data": [
    {
      "id": 789,
      "influencerId": 456,
      "influencerName": "John Doe",
      "username": "@john_doe",
      "referralCode": "JOHN123",
      "transactionType": "referral_bonus",
      "amount": 100,
      "paymentStatus": "pending",
      "upiId": "john.doe@upi",
      "paymentReferenceId": null,
      "createdAt": "2025-10-15T10:30:00.000Z",
      "paidAt": null,
      "adminNotes": null
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

**Example Request:**
```bash
curl -X GET "http://localhost:3000/admin/referral-program/transactions?paymentStatus=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Authentication

All endpoints require authentication via JWT Bearer token. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Testing with Swagger

1. Start the server: `npm run start:dev`
2. Navigate to: `http://localhost:3000/api-docs`
3. Find the "Admin" section
4. Look for endpoints starting with `/admin/referral-program/`
5. Click "Authorize" and enter your admin access token
6. Try out the endpoints

## Frontend Integration

The API endpoints map to the Refer Program page tabs as follows:

| UI Tab | API Endpoint |
|--------|-------------|
| Statistics Cards | `/admin/referral-program/statistics` |
| New Accounts With Referral | `/admin/referral-program/new-accounts` |
| Account referrer | `/admin/referral-program/account-referrers` |
| Transaction History | `/admin/referral-program/transactions` |

## Database Tables Used

- **influencers**: Stores referral codes and credits
- **influencer_referral_usages**: Tracks who used whose referral code
- **credit_transactions**: Stores payment requests and transactions

## Notes

- Growth percentages are calculated month-over-month
- All amounts are in Indian Rupees (₹)
- The existing `/admin/credit-transactions` endpoint can be used to update payment statuses
- Redeem requests can be viewed in the transactions endpoint with `paymentStatus=pending` or `paymentStatus=processing`
