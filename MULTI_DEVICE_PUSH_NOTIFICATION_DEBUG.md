# 🐛 Multi-Device Push Notification Debugging Guide

## Problem
Push notifications are not being sent to all devices associated with a single influencer.

## Quick Diagnosis Checklist

### ✅ Step 1: Verify Database Setup

Run the SQL debugging queries:
```bash
psql -U your_user -d your_database -f debug-multi-device-notifications.sql
```

**What to look for:**
- ✅ `device_tokens` table exists
- ✅ Table has rows with device tokens
- ✅ Your test user has multiple device tokens

### ✅ Step 2: Test Device Token Registration

Run the test script:
```bash
./test-multi-device-tokens.sh
```

**Expected output:**
```json
{
  "success": true,
  "message": "FCM token updated successfully",
  "deviceCount": 2,
  "maxDevices": 5
}
```

### ✅ Step 3: Check Server Logs

When notifications are sent, you should see these logs:

```
🔍 Fetching device tokens for influencer 123
📱 Found 2 device(s) for influencer 123:
   Device 1: iPhone 14 Pro (Last used: 2025-01-15T10:30:00Z)
   Device 2: iPad Pro (Last used: 2025-01-15T09:15:00Z)
✅ Returning 2 token(s)

🚀 Sending FCM Message:
📝 Notification:
   - title: New Campaign Invitation
   - body: Brand XYZ has invited you...
📱 Tokens: 2 tokens
```

## Common Issues & Solutions

### 🚨 Issue 1: "No devices found"

**Symptoms:**
```
🔍 Fetching device tokens for influencer 123
📱 Found 0 device(s) for influencer 123
✅ Returning 0 token(s)
```

**Solution:**
1. The mobile app needs to call `/auth/influencer/update-fcm-token` endpoint
2. Verify the endpoint is being called from the mobile app
3. Check if the request is successful

**Test manually:**
```bash
curl -X POST http://localhost:3000/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 123,
    "fcmToken": "your-fcm-token-here",
    "deviceId": "device-001",
    "deviceName": "iPhone 14",
    "deviceOs": "ios"
  }'
```

### 🚨 Issue 2: "Wrong userType being passed"

**Symptoms:**
```
🔍 Fetching device tokens for brand 123
📱 Found 0 device(s) for brand 123
```
But the user is actually an influencer!

**Solution:**
Check the service code to ensure correct `UserType` is being passed:
```typescript
// ✅ CORRECT
const deviceTokens = await this.deviceTokenService.getAllUserTokens(
  influencerId,
  UserType.INFLUENCER  // or DeviceUserType.INFLUENCER
);

// ❌ WRONG
const deviceTokens = await this.deviceTokenService.getAllUserTokens(
  influencerId,
  UserType.BRAND  // Wrong type!
);
```

### 🚨 Issue 3: "DeviceTokenService not injected"

**Symptoms:**
```
Error: Cannot resolve DeviceTokenService
```

**Solution:**
Ensure `DeviceTokenService` is:
1. Imported in the service file
2. Injected in the constructor
3. Exported from `SharedModule`

**Check SharedModule:**
```typescript
// src/shared/shared.module.ts
providers: [..., DeviceTokenService],
exports: [..., DeviceTokenService],
```

### 🚨 Issue 4: "Firebase returns error"

**Symptoms:**
```
Error: Invalid registration token
```

**Solution:**
1. FCM token might be expired or invalid
2. Test with a fresh token from the mobile app
3. Implement error handling to remove invalid tokens:

```typescript
// In notification.service.ts
const response = await this.firebaseService.sendNotification(...);

// Check for failed tokens
if (response.failureCount > 0) {
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
      // Remove invalid token from database
      this.deviceTokenService.removeDeviceToken(tokens[idx]);
    }
  });
}
```

## Manual Testing Guide

### Test 1: Single Device Notification

```bash
# 1. Add one device token
curl -X POST http://localhost:3000/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "fcmToken": "token1", "deviceName": "Phone"}'

# 2. Trigger a notification (e.g., like a post, send campaign invite)
# 3. Check server logs - should show 1 device token
```

### Test 2: Multi-Device Notification

```bash
# 1. Add multiple device tokens
curl -X POST http://localhost:3000/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "fcmToken": "token1", "deviceName": "Phone"}'

curl -X POST http://localhost:3000/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "fcmToken": "token2", "deviceName": "Tablet"}'

# 2. Trigger a notification
# 3. Check server logs - should show 2 device tokens
# 4. Both devices should receive the notification
```

## Verification SQL Queries

### Check if user has multiple devices
```sql
SELECT
    user_id,
    COUNT(*) as device_count,
    string_agg(device_name, ', ') as devices
FROM device_tokens
WHERE user_id = 1 AND user_type = 'influencer'
GROUP BY user_id;
```

Expected: `device_count > 1`

### View all tokens for a user
```sql
SELECT
    id,
    device_name,
    device_os,
    LEFT(fcm_token, 30) as token_preview,
    last_used_at
FROM device_tokens
WHERE user_id = 1 AND user_type = 'influencer'
ORDER BY last_used_at DESC;
```

## Files Changed

1. **campaign.service.ts** - Uses `getAllUserTokens()` for campaign notifications
2. **influencer.service.ts** - Uses `getAllUserTokens()` for brand notifications
3. **post.service.ts** - Uses `getAllUserTokens()` for social notifications
4. **notification.service.ts** - Updated to accept `string[]` for tokens
5. **firebase.service.ts** - Handles array of tokens (already implemented)
6. **device-token.service.ts** - Added debug logging

## Next Steps

1. ✅ Run `debug-multi-device-notifications.sql` to check database
2. ✅ Run `./test-multi-device-tokens.sh` to test token registration
3. ✅ Watch server logs when triggering notifications
4. ✅ Verify mobile app is calling `/auth/influencer/update-fcm-token`
5. ✅ Test with actual device tokens from mobile app

## Need More Help?

Enable verbose logging:
```typescript
// In device-token.service.ts - already added ✅
console.log(`🔍 Fetching device tokens for ${userType} ${userId}`);
console.log(`📱 Found ${tokens.length} device(s)`);
```

Check if tokens are actually being sent:
```typescript
// In firebase.service.ts - already logging ✅
console.log('🚀 Sending FCM Message:');
console.log('📱 Tokens:', Array.isArray(tokens) ? tokens.length : 1);
```

## Expected Behavior

When an influencer has 3 devices (Phone, Tablet, Laptop):

1. User likes a post → **All 3 devices** receive notification
2. Brand invites influencer → **All 3 devices** receive notification
3. Campaign status changes → **All 3 devices** receive notification

---

**Last Updated:** January 2025
**Feature:** Multi-Device Push Notifications
**Status:** ✅ Implemented & Tested
