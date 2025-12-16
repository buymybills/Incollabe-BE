# Chat API Testing Guide

## Test Users
- **Influencer**: ID 11
- **Brand**: ID 32

## JWT Tokens

### Influencer Token (ID 11)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o
```

### Brand Token (ID 32)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao
```

---

## 1. Create or Get Conversation

### Test 1.1: Influencer creates conversation with Brand

```bash
curl -X POST 'http://localhost:3002/api/chat/conversations' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -d '{
    "otherPartyId": 32,
    "otherPartyType": "brand"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "currentUser": {
      "id": 11,
      "username": "...",
      "name": "...",
      "profileImage": "..."
    },
    "otherParty": {
      "id": 32,
      "username": "...",
      "brandName": "...",
      "profileImage": "..."
    },
    "otherPartyType": "brand",
    "lastMessage": null,
    "lastMessageAt": null,
    "unreadCount": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Test 1.2: Brand creates/gets conversation with Influencer

```bash
curl -X POST 'http://localhost:3002/api/chat/conversations' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao' \
  -d '{
    "otherPartyId": 11,
    "otherPartyType": "influencer"
  }'
```

---

## 2. Get All Conversations

### Test 2.1: Influencer gets their conversations

```bash
curl -X GET 'http://localhost:3002/api/chat/conversations?page=1&limit=20' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

### Test 2.2: Brand gets their conversations

```bash
curl -X GET 'http://localhost:3002/api/chat/conversations?page=1&limit=20' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao'
```

### Test 2.3: Search conversations by name

```bash
curl -X GET 'http://localhost:3002/api/chat/conversations?page=1&limit=20&search=pvr' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": 1,
        "otherParty": {...},
        "otherPartyType": "brand",
        "lastMessage": "...",
        "lastMessageAt": "...",
        "lastMessageSenderType": "brand",
        "unreadCount": 0,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

## 3. Send Message

### Test 3.1: Send text message (using conversationId)

```bash
curl -X POST 'http://localhost:3002/api/chat/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -d '{
    "conversationId": 1,
    "content": "Hello! This is a test message.",
    "messageType": "text"
  }'
```

### Test 3.2: Send message (using otherPartyId - auto-creates conversation)

```bash
curl -X POST 'http://localhost:3002/api/chat/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao' \
  -d '{
    "otherPartyId": 11,
    "otherPartyType": "influencer",
    "content": "Hi from Brand! Nice to meet you.",
    "messageType": "text"
  }'
```

### Test 3.3: Send encrypted message

```bash
curl -X POST 'http://localhost:3002/api/chat/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -d '{
    "otherPartyId": 32,
    "otherPartyType": "brand",
    "content": "{\"encryptedKey\":\"abc123...\",\"iv\":\"xyz789...\",\"ciphertext\":\"encrypted...\",\"version\":\"v1\"}",
    "messageType": "text"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "conversationId": 1,
    "sender": {
      "id": 11,
      "username": "...",
      "name": "...",
      "profileImage": "..."
    },
    "senderType": "influencer",
    "messageType": "text",
    "content": "Hello! This is a test message.",
    "attachmentUrl": null,
    "attachmentName": null,
    "isRead": false,
    "readAt": null,
    "createdAt": "..."
  }
}
```

---

## 4. Get Messages

### Test 4.1: Get messages in a conversation

```bash
curl -X GET 'http://localhost:3002/api/chat/conversations/1/messages?page=1&limit=50' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

### Test 4.2: Get messages with pagination (load more)

```bash
curl -X GET 'http://localhost:3002/api/chat/conversations/1/messages?page=2&limit=20' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao'
```

### Test 4.3: Load messages before a specific message (infinite scroll)

```bash
curl -X GET 'http://localhost:3002/api/chat/conversations/1/messages?page=1&limit=20&beforeMessageId=100' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "sender": {...},
        "senderType": "influencer",
        "messageType": "text",
        "content": "Hello!",
        "attachmentUrl": null,
        "attachmentName": null,
        "isRead": true,
        "readAt": "...",
        "createdAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

## 5. Mark Messages as Read

### Test 5.1: Mark all unread messages as read

```bash
curl -X PUT 'http://localhost:3002/api/chat/conversations/1/read' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -d '{}'
```

### Test 5.2: Mark messages up to a specific message ID

```bash
curl -X PUT 'http://localhost:3002/api/chat/conversations/1/read' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao' \
  -d '{
    "messageId": 10
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": 5,
    "message": "5 message(s) marked as read"
  }
}
```

---

## 6. Get Unread Count

### Test 6.1: Get total unread message count

```bash
curl -X GET 'http://localhost:3002/api/chat/unread-count' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalUnread": 15,
    "conversationsWithUnread": 2
  }
}
```

---

## 7. Delete Conversation

### Test 7.1: Delete (soft delete) a conversation

```bash
curl -X DELETE 'http://localhost:3002/api/chat/conversations/1' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "message": "Conversation deleted successfully"
  }
}
```

---

## 8. Upload File for Chat

### Test 8.1: Upload an image

```bash
curl -X POST 'http://localhost:3002/api/chat/upload' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -F 'file=@/path/to/your/image.jpg'
```

### Test 8.2: Upload a video

```bash
curl -X POST 'http://localhost:3002/api/chat/upload' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao' \
  -F 'file=@/path/to/your/video.mp4'
```

### Test 8.3: Upload a document

```bash
curl -X POST 'http://localhost:3002/api/chat/upload' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -F 'file=@/path/to/your/document.pdf'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://bucket.s3.region.amazonaws.com/chat/images/file-123456.jpg",
    "fileName": "image.jpg",
    "fileSize": 204800,
    "fileType": "image/jpeg",
    "category": "image",
    "uploadedBy": "influencer",
    "uploadedById": 11
  },
  "message": "File uploaded successfully"
}
```

### Test 8.4: Send message with uploaded file

After uploading, send message with the attachment URL:

```bash
curl -X POST 'http://localhost:3002/api/chat/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -d '{
    "otherPartyId": 32,
    "otherPartyType": "brand",
    "content": "Check out this image!",
    "messageType": "image",
    "attachmentUrl": "https://bucket.s3.region.amazonaws.com/chat/images/file-123456.jpg",
    "attachmentName": "image.jpg"
  }'
```

---

## 9. E2EE: Set/Update Public Key

### Test 9.1: Influencer sets public key

```bash
curl -X PUT 'http://localhost:3002/api/e2ee/public-key' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o' \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
  }'
```

### Test 9.2: Brand sets public key

```bash
curl -X PUT 'http://localhost:3002/api/e2ee/public-key' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao' \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "publicKeyCreatedAt": "2025-11-15T10:00:00.000Z",
    "publicKeyUpdatedAt": "2025-11-15T10:00:00.000Z"
  },
  "message": "Public key updated successfully"
}
```

---

## 10. E2EE: Get Another User's Public Key

### Test 10.1: Get public key by user ID

```bash
curl -X GET 'http://localhost:3002/api/e2ee/public-key/brand/32' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

### Test 10.2: Get public key by username

```bash
curl -X GET 'http://localhost:3002/api/e2ee/public-key/brand/movie_pvr' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": 32,
    "userType": "brand",
    "name": "PVR-Inox",
    "username": "movie_pvr",
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "publicKeyCreatedAt": "2025-11-15T10:00:00.000Z",
    "publicKeyUpdatedAt": "2025-11-15T10:00:00.000Z"
  },
  "message": "Public key retrieved"
}
```

---

## 11. E2EE: Get Own Public Key

### Test 11.1: Get my public key

```bash
curl -X GET 'http://localhost:3002/api/e2ee/my-public-key' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o'
```

---

## Complete Testing Flow

### Scenario 1: Complete Chat Flow (No E2EE)

1. **Influencer creates conversation with Brand**
2. **Influencer sends a text message**
3. **Brand gets conversations** (sees new conversation with unread count)
4. **Brand gets messages** (sees influencer's message)
5. **Brand sends a reply**
6. **Brand marks messages as read**
7. **Influencer gets unread count** (should be 1 from brand's reply)

### Scenario 2: E2EE Chat Flow

1. **Both users generate and upload public keys**
2. **Influencer fetches Brand's public key**
3. **Brand fetches Influencer's public key**
4. **Influencer encrypts and sends message**
5. **Brand receives encrypted message**
6. **Brand decrypts message on client side**
7. **Brand encrypts and sends reply**
8. **Influencer receives and decrypts reply**

### Scenario 3: File Sharing

1. **Influencer uploads an image**
2. **Influencer sends message with attachment URL**
3. **Brand receives message with image**
4. **Brand uploads a document**
5. **Brand sends reply with document attachment**

---

## Quick Test Script

Save this as `test-chat-apis.sh`:

```bash
#!/bin/bash

INFLUENCER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiaW5mbHVlbmNlciIsImlhdCI6MTc2MzIxMzQxOSwiZXhwIjoxNzYzODE4MjE5LCJqdGkiOiJjMDVhNDllMi1hMTAxLTQyNWUtOGFkNy0yZDkyMjE5N2M2NTMifQ.N7PQRxSUM3nu9dkq6k0Zes2s68m0e5Jlo3nE9QG1b5o"
BRAND_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIsInByb2ZpbGVDb21wbGV0ZWQiOnRydWUsInVzZXJUeXBlIjoiYnJhbmQiLCJpYXQiOjE3NjMxNDE0OTYsImV4cCI6MTc2Mzc0NjI5NiwianRpIjoiY2Y5ZjQzNTQtYmUxMy00NGI2LWE2N2YtMjBlZjQ0NGYxMmRlIn0.s8AZpOEsASlp2CCLM304RsNeyhCTR2LwLVdG_SKg9Ao"
API_BASE="http://localhost:3002/api"

echo "=== Testing Chat APIs ==="

echo -e "\n1. Create Conversation (Influencer -> Brand)"
curl -X POST "$API_BASE/chat/conversations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INFLUENCER_TOKEN" \
  -d '{"otherPartyId": 32, "otherPartyType": "brand"}' \
  | jq .

echo -e "\n2. Send Message (Influencer)"
curl -X POST "$API_BASE/chat/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INFLUENCER_TOKEN" \
  -d '{"otherPartyId": 32, "otherPartyType": "brand", "content": "Hello from test script!", "messageType": "text"}' \
  | jq .

echo -e "\n3. Get Conversations (Brand)"
curl -X GET "$API_BASE/chat/conversations" \
  -H "Authorization: Bearer $BRAND_TOKEN" \
  | jq .

echo -e "\n4. Get Unread Count (Brand)"
curl -X GET "$API_BASE/chat/unread-count" \
  -H "Authorization: Bearer $BRAND_TOKEN" \
  | jq .

echo -e "\n=== Tests Complete ==="
```

Make it executable and run:
```bash
chmod +x test-chat-apis.sh
./test-chat-apis.sh
```

---

## Error Cases to Test

1. **Invalid conversation ID**: `GET /api/chat/conversations/99999/messages`
2. **Access forbidden**: Influencer A trying to access conversation between Influencer B and Brand C
3. **Missing required fields**: Send message without content or attachmentUrl
4. **Invalid file type**: Upload .exe file
5. **File too large**: Upload file > 50MB
6. **Chat with yourself**: Try to create conversation with same user
7. **User not found**: Create conversation with non-existent user ID
8. **No public key**: Try to get public key of user who hasn't set one up

---

**Remember**: Replace `/path/to/your/file.jpg` with actual file paths when testing file uploads!
