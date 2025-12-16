# Support Ticket System - Implementation Guide

## Overview
Complete support ticket system allowing influencers and brands to report issues and admins to manage and resolve them.

## Features Created

### 1. Database Model (`support_ticket.model.ts`)
- **Ticket Types**: Technical, Account, Payment, Report User, Campaign, Content, Other
- **Status**: Unresolved, Resolved
- **Fields**:
  - Reporter info (userType, influencerId, brandId)
  - Ticket details (subject, description, reportType)
  - Reported user (optional - for reporting other users)
  - Admin handling (assignedToAdminId, adminNotes, resolution)
  - Timestamps (createdAt, updatedAt, resolvedAt)

### 2. Migration File
**File**: `migrations/create_support_tickets_table.sql`
- Creates `support_tickets` table with all constraints
- Indexes for performance on status, priority, userType, dates
- Ensures data integrity with CHECK constraints

**To run**:
```sql
psql -U postgres -d incollab_db -f migrations/create_support_tickets_table.sql
```

### 3. DTOs
- **CreateSupportTicketDto**: For users to create tickets
- **GetSupportTicketsDto**: Admin filters (status, priority, type, search)
- **UpdateSupportTicketDto**: Admin updates (status, priority, notes, resolution)

### 4. Service (`support-ticket.service.ts`)
Methods:
- `createTicket()` - Create new support ticket
- `getMyTickets()` - User views their tickets
- `getAllTickets()` - Admin views all tickets with filters
- `getTicketById()` - Get detailed ticket info
- `updateTicket()` - Admin updates ticket
- `deleteTicket()` - Admin deletes ticket
- `getTicketStatistics()` - Dashboard stats

### 5. Admin API Endpoints

#### Get All Tickets
```http
GET /api/admin/support-tickets
Query Parameters:
  - status?: unresolved | resolved
  - reportType?: technical_issue | account_issue | payment_issue | report_user | campaign_issue | content_issue | other
  - userType?: influencer | brand
  - searchQuery?: string
  - page?: number (default: 1)
  - limit?: number (default: 20)
```

#### Get Ticket Statistics
```http
GET /api/admin/support-tickets/statistics
```

#### Get Ticket Details
```http
GET /api/admin/support-tickets/:id
```

#### Update Ticket
```http
PUT /api/admin/support-tickets/:id
Body: {
  status?: "unresolved" | "resolved",
  adminNotes?: "string",
  resolution?: "string"
}
Permissions: SUPER_ADMIN, CONTENT_MODERATOR
```

#### Delete Ticket
```http
DELETE /api/admin/support-tickets/:id
Permissions: SUPER_ADMIN only
```

## Next Steps - User Endpoints

### To Add to Influencer Controller
```typescript
// In src/influencer/influencer.controller.ts

@Post('support-ticket')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({
  summary: 'Create support ticket',
  description: 'Report an issue or another user',
})
async createSupportTicket(
  @Body() createDto: CreateSupportTicketDto,
  @Req() req: RequestWithUser,
) {
  return await this.supportTicketService.createTicket(
    createDto,
    req.user.id,
    UserType.INFLUENCER,
  );
}

@Get('support-tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({
  summary: 'Get my support tickets',
  description: 'View all tickets created by current influencer',
})
async getMyTickets(
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 20,
  @Req() req: RequestWithUser,
) {
  return await this.supportTicketService.getMyTickets(
    req.user.id,
    UserType.INFLUENCER,
    page,
    limit,
  );
}
```

### To Add to Brand Controller
```typescript
// In src/brand/brand.controller.ts

@Post('support-ticket')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({
  summary: 'Create support ticket',
  description: 'Report an issue or another user',
})
async createSupportTicket(
  @Body() createDto: CreateSupportTicketDto,
  @Req() req: RequestWithUser,
) {
  return await this.supportTicketService.createTicket(
    createDto,
    req.user.id,
    UserType.BRAND,
  );
}

@Get('support-tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({
  summary: 'Get my support tickets',
  description: 'View all tickets created by current brand',
})
async getMyTickets(
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 20,
  @Req() req: RequestWithUser,
) {
  return await this.supportTicketService.getMyTickets(
    req.user.id,
    UserType.BRAND,
    page,
    limit,
  );
}
```

## Example Usage

### User Creates Ticket
```http
POST /api/influencer/support-ticket
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "Cannot upload post image",
  "description": "Getting error 500 when trying to upload images to posts",
  "reportType": "technical_issue"
}
```

### User Reports Another User
```http
POST /api/influencer/support-ticket
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "Inappropriate behavior",
  "description": "Brand is sending harassing messages",
  "reportType": "report_user",
  "reportedUserType": "brand",
  "reportedUserId": 123
}
```

### Admin Views Unresolved Tickets
```http
GET /api/admin/support-tickets?status=unresolved
Authorization: Bearer <admin-token>
```

### Admin Resolves Ticket
```http
PUT /api/admin/support-tickets/5
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "resolved",
  "resolution": "Fixed the upload issue. Updated image processing library."
}
```

## Frontend UI Recommendations

### Admin Dashboard Tab
Show summary cards:
- Total Tickets: 50
- Unresolved: 20 (Red badge)
- Resolved: 30 (Green badge)

### Ticket List Features
- Filter dropdown: Status, Type, User Type
- Search bar: Search in subject/description
- Sort: By date (newest first)
- Status badges with colors
- Quick actions: View, Assign to me, Mark resolved

### Ticket Detail Page
- Reporter info with profile link
- Reported user info (if applicable)
- Full description
- Status change dropdown
- Admin notes field (internal)
- Resolution field (sent to user)
- Timeline of status changes

## Testing

Run migration:
```bash
cd /Users/bhartimishra/Desktop/bmb/Incollabe-BE
psql -U postgres -d incollab_db -f migrations/create_support_tickets_table.sql
```

Test admin endpoints:
```bash
# Start server
npm run start:dev

# Get statistics
curl -X GET 'http://localhost:3002/api/admin/support-tickets/statistics' \
  -H 'Authorization: Bearer <admin-token>'

# Get all tickets
curl -X GET 'http://localhost:3002/api/admin/support-tickets?status=unresolved' \
  -H 'Authorization: Bearer <admin-token>'
```

## Files Modified/Created

### Created:
1. `src/shared/models/support-ticket.model.ts` - Database model
2. `src/shared/dto/create-support-ticket.dto.ts` - Create DTO
3. `src/shared/dto/get-support-tickets.dto.ts` - Query filters DTO
4. `src/shared/dto/update-support-ticket.dto.ts` - Update DTO
5. `src/shared/support-ticket.service.ts` - Business logic
6. `migrations/create_support_tickets_table.sql` - Database migration

### Modified:
1. `src/shared/shared.module.ts` - Added SupportTicket model and service
2. `src/admin/admin.controller.ts` - Added 5 admin endpoints
3. `src/database/postgres.db.ts` - Registered SupportTicket model

## Status
✅ Database model created
✅ Migration file created
✅ Service implemented with all methods
✅ Admin API endpoints added (5 endpoints)
✅ Module configuration updated

⏳ **Pending**: Add user endpoints to Influencer and Brand controllers
⏳ **Pending**: Run database migration
⏳ **Pending**: Test all endpoints
