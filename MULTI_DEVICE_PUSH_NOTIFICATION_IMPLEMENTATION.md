# Multi-Device Push Notification Implementation Guide

## Problem Statement

**Current Issue:**
- Users can only receive push notifications on their **latest logged-in device**
- The `fcmToken` field in `Influencer` and `Brand` models stores only ONE token (string)
- When a user logs in from a new device, it overwrites the previous token
- Old devices stop receiving notifications

**Required Solution:**
- Allow up to **5 simultaneous device logins** per user
- Send push notifications to **ALL logged-in devices**
- Automatically remove oldest device when 6th device tries to login
- Track device information for better management

---

## Solution Architecture

### 1. Database Schema (✅ CREATED)

**New Table: `device_tokens`**

```sql
CREATE TABLE device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('influencer', 'brand', 'admin')),
  fcm_token VARCHAR(500) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  device_name VARCHAR(100),
  device_os VARCHAR(20),
  app_version VARCHAR(20),
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Migration File:** `migrations/create_device_tokens_table.sql`

### 2. Sequelize Model (✅ CREATED)

**File:** `src/shared/models/device-token.model.ts`

- Model: `DeviceToken`
- Supports multiple tokens per user
- Tracks device metadata (OS, name, version)
- Indexed for fast lookups

### 3. Device Token Service (✅ CREATED)

**File:** `src/shared/device-token.service.ts`

**Key Methods:**
- `addOrUpdateDeviceToken()` - Add new device or update existing (enforces 5-device limit)
- `getAllUserTokens()` - Get all FCM tokens for sending notifications
- `getUserDevices()` - Get device list for UI display
- `removeDeviceToken()` - Logout from specific device
- `removeAllUserDevices()` - Logout from all devices
- `cleanupOldTokens()` - Cron job to remove inactive tokens

**5-Device Limit Logic:**
```typescript
// If user has >= 5 devices, remove the oldest one
if (userDeviceCount >= this.MAX_DEVICES_PER_USER) {
  const oldestDevice = await this.deviceTokenModel.findOne({
    where: { userId, userType },
    order: [['lastUsedAt', 'ASC']],
  });
  await oldestDevice.destroy();
}
```

### 4. Updated DTO (✅ UPDATED)

**File:** `src/auth/dto/update-fcm-token.dto.ts`

**New Fields:**
- `deviceId` - Unique device identifier
- `deviceName` - "iPhone 13 Pro", "Samsung Galaxy S21"
- `deviceOs` - 'ios' | 'android'
- `appVersion` - "1.2.3"

---

## Implementation Steps

### Step 1: Run Database Migration

```bash
# Connect to your database and run:
psql -U your_user -d your_database -f migrations/create_device_tokens_table.sql
```

### Step 2: Update Module Providers

**File:** `src/shared/shared.module.ts`

```typescript
import { DeviceToken } from './models/device-token.model';
import { DeviceTokenService } from './device-token.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      // ... existing models
      DeviceToken, // ADD THIS
    ]),
  ],
  providers: [
    // ... existing services
    DeviceTokenService, // ADD THIS
  ],
  exports: [
    // ... existing exports
    DeviceTokenService, // ADD THIS
  ],
})
export class SharedModule {}
```

### Step 3: Update Auth Service

**File:** `src/auth/auth.service.ts`

**3.1. Inject DeviceTokenService in constructor:**

```typescript
import { DeviceTokenService } from '../shared/device-token.service';
import { UserType } from '../shared/models/device-token.model';

constructor(
  // ... existing dependencies
  private readonly deviceTokenService: DeviceTokenService, // ADD THIS
) {}
```

**3.2. Update `updateFcmToken()` method:**

```typescript
/**
 * Update FCM token for influencer (supports multiple devices)
 */
async updateFcmToken(
  userId: number,
  fcmToken: string,
  deviceId?: string,
  deviceName?: string,
  deviceOs?: 'ios' | 'android',
  appVersion?: string,
) {
  const influencer = await this.influencerModel.findByPk(userId);

  if (!influencer) {
    throw new NotFoundException('Influencer not found');
  }

  // Add or update device token (enforces 5-device limit)
  await this.deviceTokenService.addOrUpdateDeviceToken({
    userId,
    userType: UserType.INFLUENCER,
    fcmToken,
    deviceId,
    deviceName,
    deviceOs,
    appVersion,
  });

  // Still update the main fcmToken field for backward compatibility
  await influencer.update({ fcmToken });

  // Get current device count
  const deviceCount = await this.deviceTokenService.getUserDeviceCount(
    userId,
    UserType.INFLUENCER,
  );

  return {
    success: true,
    message: 'FCM token updated successfully',
    deviceCount,
    maxDevices: 5,
  };
}
```

### Step 4: Update Auth Controller

**File:** `src/auth/auth.controller.ts`

```typescript
async updateFcmToken(@Body() updateFcmTokenDto: UpdateFcmTokenDto) {
  return this.authService.updateFcmToken(
    updateFcmTokenDto.userId,
    updateFcmTokenDto.fcmToken,
    updateFcmTokenDto.deviceId,      // NEW
    updateFcmTokenDto.deviceName,    // NEW
    updateFcmTokenDto.deviceOs,      // NEW
    updateFcmTokenDto.appVersion,    // NEW
  );
}
```

### Step 5: Update Notification Methods

**File:** `src/shared/notification.service.ts`

**Add helper method to get all user tokens:**

```typescript
import { DeviceTokenService } from './device-token.service';
import { UserType } from './models/device-token.model';

constructor(
  private readonly firebaseService: FirebaseService,
  private readonly deviceTokenService: DeviceTokenService, // ADD THIS
) {}

/**
 * Send notification to ALL devices of an influencer
 */
async sendToInfluencer(influencerId: number, title: string, body: string, data?: any) {
  // Get all FCM tokens for this influencer
  const tokens = await this.deviceTokenService.getAllUserTokens(
    influencerId,
    UserType.INFLUENCER,
  );

  if (tokens.length === 0) {
    console.log(`⚠️ No FCM tokens found for influencer ${influencerId}`);
    return { success: false, message: 'No devices registered' };
  }

  console.log(`📤 Sending notification to ${tokens.length} device(s) for influencer ${influencerId}`);

  // Firebase service already supports sending to multiple tokens!
  return await this.firebaseService.sendNotification(
    tokens, // Pass array of tokens
    title,
    body,
    data,
  );
}

/**
 * Send notification to ALL devices of a brand
 */
async sendToBrand(brandId: number, title: string, body: string, data?: any) {
  const tokens = await this.deviceTokenService.getAllUserTokens(
    brandId,
    UserType.BRAND,
  );

  if (tokens.length === 0) {
    console.log(`⚠️ No FCM tokens found for brand ${brandId}`);
    return { success: false, message: 'No devices registered' };
  }

  console.log(`📤 Sending notification to ${tokens.length} device(s) for brand ${brandId}`);

  return await this.firebaseService.sendNotification(
    tokens,
    title,
    body,
    data,
  );
}
```

**Update existing notification methods:**

```typescript
// OLD WAY (single device):
async sendCampaignStatusUpdate(
  fcmToken: string,  // ❌ Single token
  campaignName: string,
  status: string,
) {
  return await this.firebaseService.sendNotification(
    fcmToken,
    `Campaign Update`,
    `...`,
  );
}

// NEW WAY (all devices):
async sendCampaignStatusUpdate(
  influencerId: number,  // ✅ User ID instead
  campaignName: string,
  status: string,
) {
  const tokens = await this.deviceTokenService.getAllUserTokens(
    influencerId,
    UserType.INFLUENCER,
  );

  if (tokens.length === 0) return;

  return await this.firebaseService.sendNotification(
    tokens,  // ✅ Array of all user's tokens
    `Campaign Update`,
    `...`,
  );
}
```

### Step 6: Update Campaign Service (Example)

**Wherever you send notifications, change from:**

```typescript
// OLD:
await this.notificationService.sendCampaignStatusUpdate(
  influencer.fcmToken,  // ❌ Single token
  campaign.name,
  'approved',
);

// NEW:
await this.notificationService.sendCampaignStatusUpdate(
  influencer.id,  // ✅ User ID
  campaign.name,
  'approved',
);
```

---

## Additional Features to Add

### 1. View Logged-In Devices (UI Feature)

**Add endpoint in auth controller:**

```typescript
@Get('influencer/devices')
@UseGuards(AuthGuard)
async getMyDevices(@Req() req: any) {
  const userId = req.user.id;

  const devices = await this.deviceTokenService.getUserDevices(
    userId,
    UserType.INFLUENCER,
  );

  return {
    success: true,
    devices: devices.map(d => ({
      id: d.id,
      deviceName: d.deviceName || 'Unknown Device',
      deviceOs: d.deviceOs,
      lastUsedAt: d.lastUsedAt,
      isCurrent: d.fcmToken === req.user.currentFcmToken, // Requires passing current token
    })),
    maxDevices: 5,
  };
}
```

### 2. Logout from Specific Device

```typescript
@Delete('influencer/devices/:deviceId')
@UseGuards(AuthGuard)
async logoutFromDevice(@Param('deviceId') deviceId: number) {
  const device = await this.deviceTokenService.findOne(deviceId);

  if (!device) {
    throw new NotFoundException('Device not found');
  }

  await this.deviceTokenService.removeDeviceToken(device.fcmToken);

  return {
    success: true,
    message: 'Logged out from device successfully',
  };
}
```

### 3. Logout from All Devices

```typescript
@Delete('influencer/devices/all')
@UseGuards(AuthGuard)
async logoutFromAllDevices(@Req() req: any) {
  const userId = req.user.id;

  const count = await this.deviceTokenService.removeAllUserDevices(
    userId,
    UserType.INFLUENCER,
  );

  return {
    success: true,
    message: `Logged out from ${count} device(s)`,
  };
}
```

### 4. Cleanup Cron Job (Remove Inactive Tokens)

**Add to subscription-scheduler.service.ts:**

```typescript
import { DeviceTokenService } from '../shared/device-token.service';

constructor(
  private readonly proSubscriptionService: ProSubscriptionService,
  private readonly deviceTokenService: DeviceTokenService, // ADD
) {}

@Cron('0 3 * * *') // Every day at 3 AM
async cleanupInactiveDevices() {
  console.log('🧹 Cleaning up inactive device tokens...');

  const removed = await this.deviceTokenService.cleanupOldTokens(90); // 90 days

  console.log(`✅ Removed ${removed} inactive device token(s)`);
}
```

---

## Testing Guide

### Test 1: Register Multiple Devices

```bash
# Device 1 (iPhone)
curl -X POST http://localhost:3002/api/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 7,
    "fcmToken": "token_device_1_iphone",
    "deviceId": "iPhone-UUID-123",
    "deviceName": "iPhone 13 Pro",
    "deviceOs": "ios",
    "appVersion": "1.0.0"
  }'

# Device 2 (Android)
curl -X POST http://localhost:3002/api/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 7,
    "fcmToken": "token_device_2_android",
    "deviceId": "Android-UUID-456",
    "deviceName": "Samsung Galaxy S21",
    "deviceOs": "android",
    "appVersion": "1.0.0"
  }'

# Device 3, 4, 5...
# (Same pattern)
```

### Test 2: Verify Multi-Device Notifications

```sql
-- Check device tokens
SELECT * FROM device_tokens WHERE user_id = 7 AND user_type = 'influencer';

-- Should show all devices (max 5)
```

### Test 3: Test 5-Device Limit

```bash
# Add 6th device - should auto-remove oldest
curl -X POST http://localhost:3002/api/auth/influencer/update-fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 7,
    "fcmToken": "token_device_6",
    "deviceName": "iPad Pro",
    "deviceOs": "ios"
  }'

# Check logs - should see: "🗑️ Removed oldest device token"
```

### Test 4: Send Test Notification to All Devices

```typescript
// In your test file or controller
const tokens = await deviceTokenService.getAllUserTokens(7, UserType.INFLUENCER);
console.log(`Found ${tokens.length} devices`); // Should be max 5

await notificationService.sendToInfluencer(
  7,
  'Test Notification',
  'This should arrive on ALL your devices!',
);

// Check all devices - notification should appear on all
```

---

## Migration Strategy

### Option A: Immediate Migration (Recommended)

1. Run database migration
2. Deploy code with new logic
3. Old `fcmToken` fields remain but are secondary
4. New `device_tokens` table becomes primary source

**Backward Compatibility:**
- Auth service still updates `Influencer.fcmToken` (last device)
- Old notification code still works (sends to last device)
- New notification code uses `device_tokens` (sends to all devices)

### Option B: Gradual Migration

1. Deploy code but keep using old `fcmToken` fields
2. Start populating `device_tokens` table in background
3. After 1 week, switch notification sending to new table
4. After 1 month, deprecate old `fcmToken` fields

---

## Expected Behavior After Implementation

### Scenario 1: User Logs In from Multiple Devices

**Before:**
```
User logs in on iPhone  → notifications only on iPhone
User logs in on Android → notifications ONLY on Android (iPhone stops)
```

**After:**
```
User logs in on iPhone  → notifications on iPhone
User logs in on Android → notifications on BOTH iPhone and Android
User logs in on iPad    → notifications on all 3 devices
... up to 5 devices
User logs in on 6th device → oldest device removed, notifications on latest 5
```

### Scenario 2: Subscription Charged Webhook

**Current:**
```
Webhook received
  → Notification sent to influencer.fcmToken
  → Only latest device receives it
```

**After Implementation:**
```
Webhook received
  → Get all tokens: deviceTokenService.getAllUserTokens(influencerId)
  → Send to all: firebaseService.sendNotification(tokens, ...)
  → ALL user's devices receive notification
```

---

## Summary

**Files Created:**
- ✅ `migrations/create_device_tokens_table.sql`
- ✅ `src/shared/models/device-token.model.ts`
- ✅ `src/shared/device-token.service.ts`
- ✅ Updated: `src/auth/dto/update-fcm-token.dto.ts`

**Files to Update:**
- `src/shared/shared.module.ts` - Add DeviceToken model and service
- `src/auth/auth.service.ts` - Inject and use DeviceTokenService
- `src/auth/auth.controller.ts` - Pass device info to updateFcmToken
- `src/shared/notification.service.ts` - Add sendToInfluencer/sendToBrand methods
- All services that send notifications - Use user ID instead of FCM token

**Benefits:**
- ✅ Notifications reach ALL user devices (up to 5)
- ✅ Better user experience
- ✅ Device management UI capabilities
- ✅ Automatic cleanup of old devices
- ✅ Backward compatible with existing code

**Next Steps:**
1. Run migration SQL
2. Update module providers
3. Update auth service and controller
4. Update notification service
5. Test with multiple devices
6. Deploy!
