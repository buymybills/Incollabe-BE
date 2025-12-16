# Bulk Notification Upload System

## Overview
Send notifications to specific users by uploading an Excel file with their details (name, email, phone).

---

## Features
✅ Upload Excel file with user list
✅ Automatic user matching by email or phone
✅ Support for both influencers and brands
✅ Send immediately or save as draft
✅ Full iOS and Android support
✅ Deep linking and rich notifications
✅ Detailed matching report with not-found users
✅ Download Excel template

---

## API Endpoints

### 1. Download Excel Template
**GET** `/api/admin/notifications/template/:userType`

Downloads a template Excel file with sample data.

**Parameters:**
- `userType`: `influencer` or `brand`

**Example:**
```bash
curl -X GET "https://api.teamcollabkaroo.com/api/admin/notifications/template/influencer" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o template.xlsx
```

### 2. Bulk Upload Notification
**POST** `/api/admin/notifications/bulk-upload`

Upload Excel file and create notification.

**Form Data Fields:**
- `file` (required): Excel file (.xlsx or .xls)
- `title` (required): Notification title
- `body` (required): Notification message
- `userType` (required): `influencer` or `brand`
- `sendImmediately` (optional): `true` or `false` (default: false)
- `imageUrl` (optional): Image URL for rich notification
- `actionUrl` (optional): Deep link URL
- `androidChannelId` (optional): Android channel ID
- `sound` (optional): `default`, `custom`, or `silent`
- `priority` (optional): `high`, `normal`, or `low`
- `badge` (optional): iOS badge count (number)
- `threadId` (optional): iOS thread ID for grouping
- `interruptionLevel` (optional): `passive`, `active`, `timeSensitive`, or `critical`

---

## Excel File Format

### Required Columns
| name | email | phone |
|------|-------|-------|
| John Doe | john@example.com | +919876543210 |
| Jane Smith | jane@example.com | +919876543211 |
| | user3@example.com | |
| User Four | | +919876543212 |

**Rules:**
- At least one of `email` or `phone` must be provided for each row
- `name` is optional (for reference only, not used for matching)
- Phone numbers should include country code
- Email addresses are case-insensitive
- Column names can be in any case (email, Email, EMAIL)

### Alternative Column Names
The system accepts these column name variations:
- **Email**: `email`, `Email`, `EMAIL`
- **Phone**: `phone`, `Phone`, `PHONE`, `mobile`, `Mobile`
- **Name**: `name`, `Name`, `NAME`

---

## How It Works

### Step 1: Create Excel File
1. Download template or create your own
2. Add user details (name, email, phone)
3. Save as .xlsx or .xls file

### Step 2: Upload and Create Notification
```bash
curl -X POST "https://api.teamcollabkaroo.com/api/admin/notifications/bulk-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.xlsx" \
  -F "title=Special Campaign Invitation" \
  -F "body=You have been selected for our exclusive campaign" \
  -F "userType=influencer" \
  -F "badge=1" \
  -F "priority=high" \
  -F "sendImmediately=false"
```

### Step 3: Review Results
The API returns:
- Total users in file
- Successfully matched users
- Not found users (with details)
- Notification ID (for sending later)

### Step 4: Send Notification (if not sent immediately)
```bash
curl -X POST "https://api.teamcollabkaroo.com/api/admin/notifications/NOTIFICATION_ID/send" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Notification created successfully. Matched 45 out of 50 recipients.",
  "notificationId": 123,
  "totalInFile": 50,
  "matchedUsers": 45,
  "notFoundUsers": 5,
  "notFoundList": [
    {
      "name": "John Doe",
      "email": "john@notfound.com",
      "phone": "+919999999999"
    }
  ],
  "status": "draft",
  "sendResults": null
}
```

### With Immediate Send
```json
{
  "success": true,
  "message": "Notification created successfully. Matched 45 out of 50 recipients.",
  "notificationId": 123,
  "totalInFile": 50,
  "matchedUsers": 45,
  "notFoundUsers": 5,
  "notFoundList": [],
  "status": "sent",
  "sendResults": {
    "successCount": 44,
    "failureCount": 1
  }
}
```

---

## Complete Examples

### Example 1: Simple Notification (Save as Draft)
```bash
curl -X POST "https://api.teamcollabkaroo.com/api/admin/notifications/bulk-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@influencers.xlsx" \
  -F "title=Campaign Update" \
  -F "body=New campaign opportunities available" \
  -F "userType=influencer"
```

### Example 2: Rich Notification with Deep Link
```bash
curl -X POST "https://api.teamcollabkaroo.com/api/admin/notifications/bulk-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@influencers.xlsx" \
  -F "title=Exclusive Campaign Invitation" \
  -F "body=Check out this exclusive fashion campaign" \
  -F "imageUrl=https://example.com/campaign-banner.jpg" \
  -F "actionUrl=app://campaigns/123" \
  -F "userType=influencer" \
  -F "badge=1" \
  -F "priority=high"
```

### Example 3: Send Immediately
```bash
curl -X POST "https://api.teamcollabkaroo.com/api/admin/notifications/bulk-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@brands.xlsx" \
  -F "title=New Features Available" \
  -F "body=Check out our new campaign management features" \
  -F "userType=brand" \
  -F "sendImmediately=true" \
  -F "androidChannelId=updates" \
  -F "threadId=feature-updates" \
  -F "interruptionLevel=active"
```

### Example 4: Time-Sensitive iOS Notification
```bash
curl -X POST "https://api.teamcollabkaroo.com/api/admin/notifications/bulk-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.xlsx" \
  -F "title=Urgent: Campaign Deadline" \
  -F "body=Campaign closes in 2 hours. Apply now!" \
  -F "userType=influencer" \
  -F "badge=5" \
  -F "threadId=urgent-deadlines" \
  -F "interruptionLevel=timeSensitive" \
  -F "priority=high" \
  -F "sendImmediately=true"
```

---

## User Matching Logic

### Priority Order:
1. **Email Match**: System first tries to match by email (case-insensitive)
2. **Phone Match**: If email not found, tries to match by phone
3. **FCM Token Check**: Only users with valid FCM tokens are included
4. **Deduplication**: Each user is included only once (even if multiple rows match)

### Example Scenarios:

**Scenario 1: Email Match**
```
Excel: john@example.com
Database: john@example.com ✅ MATCH
```

**Scenario 2: Phone Match**
```
Excel: +919876543210
Database: +919876543210 ✅ MATCH
```

**Scenario 3: Both Provided, Email Takes Priority**
```
Excel: john@example.com, +919876543210
Database: john@example.com ✅ MATCH (email matched first)
```

**Scenario 4: No FCM Token**
```
Excel: john@example.com
Database: john@example.com (but no FCM token) ❌ SKIPPED
```

---

## Error Handling

### Common Errors:

**1. No File Uploaded**
```json
{
  "statusCode": 400,
  "message": "Excel file is required"
}
```

**2. Invalid File Type**
```json
{
  "statusCode": 400,
  "message": "Invalid file type. Please upload Excel file (.xlsx or .xls)"
}
```

**3. Empty Excel File**
```json
{
  "statusCode": 400,
  "message": "No recipients found in Excel file. Please check the file format."
}
```

**4. No Matching Users**
```json
{
  "statusCode": 400,
  "message": "No matching users found in database. Please check email/phone numbers."
}
```

---

## Best Practices

### ✅ DO:
- Download the template first to see the correct format
- Include country code in phone numbers (+91 for India)
- Use valid email addresses
- Test with a small batch first (5-10 users)
- Review the not-found list before sending
- Save as draft first, review, then send

### ❌ DON'T:
- Mix influencers and brands in one file (separate uploads required)
- Use special characters in names that might break Excel
- Include duplicate entries (system deduplicates automatically)
- Upload files larger than 10MB
- Send to users without verifying the match results

---

## Integration with Frontend

### HTML Form Example
```html
<form id="bulkUploadForm">
  <input type="file" name="file" accept=".xlsx,.xls" required>
  <input type="text" name="title" placeholder="Notification Title" required>
  <textarea name="body" placeholder="Message" required></textarea>
  <select name="userType" required>
    <option value="influencer">Influencers</option>
    <option value="brand">Brands</option>
  </select>
  <input type="checkbox" name="sendImmediately"> Send Immediately
  <button type="submit">Upload & Create</button>
</form>

<script>
document.getElementById('bulkUploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const response = await fetch('https://api.teamcollabkaroo.com/api/admin/notifications/bulk-upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
    },
    body: formData
  });

  const result = await response.json();
  console.log('Result:', result);
  alert(`Matched ${result.matchedUsers} out of ${result.totalInFile} users`);
});
</script>
```

---

## Testing

### Test File: influencers-test.xlsx
| name | email | phone |
|------|-------|-------|
| Test User 1 | test1@example.com | +919876543210 |
| Test User 2 | test2@example.com | +919876543211 |
| Test User 3 | test3@example.com | +919876543212 |

Save this as Excel and test the upload!

---

## Monitoring & Analytics

After sending bulk notifications, check:
- Total recipients
- Success count
- Failure count
- Delivery rate percentage
- Not-found users list

Use the notification ID to track performance:
```bash
curl -X GET "https://api.teamcollabkaroo.com/api/admin/notifications/NOTIFICATION_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## FAQ

**Q: What's the maximum file size?**
A: 10MB (approximately 100,000 rows)

**Q: Can I upload both influencers and brands together?**
A: No, create separate uploads for each user type

**Q: What happens to users not found in database?**
A: They're listed in the response but not included in the notification

**Q: Can I edit the notification after creating it?**
A: Yes, if it's still in draft status. Use PUT `/api/admin/notifications/:id`

**Q: How do I resend to failed users?**
A: Use the failure report to create a new Excel with failed users and re-upload

**Q: Does it support CSV files?**
A: No, only Excel files (.xlsx, .xls)

---

## Support

For issues or questions:
- Check the not-found users list
- Verify email/phone formats
- Ensure users have FCM tokens registered
- Test with template file first
