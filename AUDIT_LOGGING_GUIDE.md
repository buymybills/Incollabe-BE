# Audit Logging Integration Guide

## Overview
The audit logging system is now fully implemented and ready to track all admin and employee actions. This guide explains how to integrate audit logging into your services.

## Core Components Created

### 1. AuditLog Model (`src/admin/models/audit-log.model.ts`)
- Tracks all admin actions with timestamps
- Fields: adminId, adminName, adminEmail, section, actionType, details, targetType, targetId, ipAddress, userAgent
- Enums: `AuditSection` and `AuditActionType` for categorization

### 2. AuditLogService (`src/admin/services/audit-log.service.ts`)
- Provides helper methods for logging different types of actions
- Methods:
  - `createLog(data)` - General purpose logging
  - `logAuth(admin, actionType, details, ip, userAgent)` - For authentication actions
  - `logCampaignAction(...)` - For campaign-related actions
  - `logNotificationAction(...)` - For notification actions
  - `logBrandAction(...)` - For brand management
  - `logInfluencerAction(...)` - For influencer management
  - `logProfileReviewAction(...)` - For profile reviews
  - `logAdminManagement(...)` - For admin user management
  - `logPostAction(...)` - For post moderation
  - `logSettingsChange(...)` - For settings updates

### 3. API Endpoint (`GET /admin/audit-logs`)
- Filters: section, actionType, adminId, targetType, targetId, startDate, endDate, search
- Pagination: page, limit
- Returns: logs array, total count, totalPages, totalAdminUsers

### 4. Database Migration (`migrations/create_audit_logs_table.sql`)
- Creates `audit_logs` table with proper indexes
- Run this migration before testing

## How to Integrate Audit Logging

### Step 1: Inject AuditLogService

```typescript
import { AuditLogService } from './services/audit-log.service';
import { AuditActionType } from './models/audit-log.model';

@Injectable()
export class YourService {
  constructor(
    // ... other dependencies
    private readonly auditLogService: AuditLogService,
  ) {}
}
```

### Step 2: Extract Request Context (Optional)

For IP address and user agent, extract from the request object:

```typescript
// In controller
async someAction(@Req() req: RequestWithAdmin) {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  await this.service.performAction(req.admin, ipAddress, userAgent);
}
```

### Step 3: Call Audit Logging

#### Example 1: Login Action (in AdminAuthService.login)

```typescript
async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
  // ... existing login logic ...
  
  // After successful login
  await this.auditLogService.logAuth(
    {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
    },
    AuditActionType.LOGIN,
    `Admin logged in successfully`,
    ipAddress,
    userAgent,
  );
  
  return { accessToken, refreshToken, admin };
}
```

#### Example 2: Campaign Approval (in AdminCampaignService)

```typescript
async approveCampaign(
  campaignId: number,
  admin: { id: number; firstName: string; lastName: string; email: string },
  ipAddress?: string,
  userAgent?: string,
) {
  const campaign = await this.campaignModel.findByPk(campaignId);
  
  // ... approval logic ...
  
  await this.auditLogService.logCampaignAction(
    admin,
    AuditActionType.CAMPAIGN_APPROVED,
    campaignId,
    `Campaign "${campaign.title}" approved by admin`,
    ipAddress,
    userAgent,
  );
}
```

#### Example 3: Notification Creation (in PushNotificationService)

```typescript
async createNotification(
  createDto: CreateNotificationDto,
  adminId: number,
  ipAddress?: string,
  userAgent?: string,
) {
  const admin = await this.adminModel.findByPk(adminId);
  const notification = await this.pushNotificationModel.create(/* ... */);
  
  await this.auditLogService.logNotificationAction(
    {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
    },
    AuditActionType.NOTIFICATION_CREATED,
    notification.id,
    `Created notification: "${notification.title}"`,
    ipAddress,
    userAgent,
  );
  
  return notification;
}
```

#### Example 4: Brand Verification (in ProfileReviewService)

```typescript
async verifyBrand(
  brandId: number,
  admin: { id: number; firstName: string; lastName: string; email: string },
  ipAddress?: string,
  userAgent?: string,
) {
  const brand = await this.brandModel.findByPk(brandId);
  await brand.update({ isVerified: true });
  
  await this.auditLogService.logBrandAction(
    admin,
    AuditActionType.BRAND_VERIFIED,
    brandId,
    `Brand "${brand.brandName}" verified`,
    ipAddress,
    userAgent,
  );
}
```

## Available Action Types

### Auth Section
- `LOGIN`, `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_CHANGE`
- `TWO_FACTOR_ENABLED`, `TWO_FACTOR_DISABLED`

### Campaigns Section
- `CAMPAIGN_TYPE_CHANGE`, `CAMPAIGN_APPROVED`, `CAMPAIGN_REJECTED`, `CAMPAIGN_DELETED`

### Notification Centre Section
- `NOTIFICATION_CREATED`, `NOTIFICATION_UPDATED`, `NOTIFICATION_DELETED`, `NOTIFICATION_SENT`

### Profile Review Section
- `PROFILE_APPROVED`, `PROFILE_REJECTED`, `PROFILE_SUSPENDED`, `PROFILE_ACTIVATED`

### Brand Section
- `BRAND_PROFILE_CREATED`, `BRAND_PROFILE_UPDATED`, `BRAND_VERIFIED`, `BRAND_UNVERIFIED`
- `BRAND_TOP_STATUS_CHANGED`

### Influencer Section
- `INFLUENCER_PROFILE_CREATED`, `INFLUENCER_PROFILE_UPDATED`, `INFLUENCER_VERIFIED`, `INFLUENCER_UNVERIFIED`
- `INFLUENCER_TOP_STATUS_CHANGED`

### Admin Management Section
- `ADMIN_CREATED`, `ADMIN_UPDATED`, `ADMIN_DELETED`, `ADMIN_STATUS_CHANGED`

### Posts Section
- `POST_DELETED`, `POST_FLAGGED`, `POST_UNFLAGGED`

### Settings Section
- `SETTINGS_UPDATED`

## Testing the API

### 1. Run the Migration

```bash
psql -U your_user -d your_database -f migrations/create_audit_logs_table.sql
```

### 2. Test Creating Logs

After integrating audit logging in services, perform actions through the admin panel and verify logs are created.

### 3. Query Audit Logs

```bash
curl -X GET "http://localhost:3002/api/admin/audit-logs?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Filter Examples:

```bash
# Filter by section
/admin/audit-logs?section=Auth

# Filter by action type
/admin/audit-logs?actionType=Login

# Filter by date range
/admin/audit-logs?startDate=2025-10-01T00:00:00Z&endDate=2025-10-31T23:59:59Z

# Search
/admin/audit-logs?search=campaign

# Filter by admin
/admin/audit-logs?adminId=1

# Combined filters
/admin/audit-logs?section=Campaigns&actionType=Campaign%20Approved&page=1&limit=20
```

## Priority Integration Points

### High Priority (Core Actions)
1. **AdminAuthService**: login, logout, logoutAll, verifyLoginOtp
2. **ProfileReviewService**: approveProfile, rejectProfile
3. **PushNotificationService**: createNotification, updateNotification, deleteNotification
4. **AdminCampaignService**: approveCampaign, rejectCampaign

### Medium Priority
1. **Brand/Influencer verification**: verifyBrand, verifyInfluencer
2. **Top status changes**: toggleTopInfluencer, toggleTopBrand
3. **Admin management**: createAdmin, updateAdminStatus, deleteAdmin

### Low Priority
1. Post moderation actions
2. Settings changes
3. Profile updates

## Implementation Checklist

- [x] AuditLog model created
- [x] AuditLogService created with helper methods
- [x] API endpoint added (GET /admin/audit-logs)
- [x] DTOs and interfaces defined
- [x] Database migration created
- [x] Module registration completed
- [ ] Integrate in AdminAuthService (login, logout, OTP verification)
- [ ] Integrate in ProfileReviewService (approve/reject profiles)
- [ ] Integrate in PushNotificationService (CRUD operations)
- [ ] Integrate in AdminCampaignService (approve/reject campaigns)
- [ ] Add IP address and user agent extraction in controllers
- [ ] Test all audit log entries are created correctly
- [ ] Test audit log retrieval API with various filters

## Notes

- Audit logging is designed to be non-blocking - if logging fails, it won't break the main operation
- All audit log helper methods handle errors internally
- IP address and user agent are optional but recommended for security tracking
- The `details` field can store additional context (JSON strings, descriptions, etc.)
- Consider adding an interceptor for automatic audit logging in the future
