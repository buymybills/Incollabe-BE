# Chat System Documentation

## Overview

The chat system enables one-to-one messaging between influencers and brands in the Incollabe platform. It provides real-time communication capabilities with features like message history, unread counts, and typing indicators support.

## Database Schema

### Tables

#### `conversations`
Stores one-to-one conversations between influencers and brands.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| influencer_id | INTEGER | Foreign key to influencers table |
| brand_id | INTEGER | Foreign key to brands table |
| last_message | TEXT | Preview of the last message |
| last_message_at | TIMESTAMP | When the last message was sent |
| last_message_sender_type | VARCHAR(20) | Who sent the last message (influencer/brand) |
| unread_count_influencer | INTEGER | Unread messages for influencer |
| unread_count_brand | INTEGER | Unread messages for brand |
| is_active | BOOLEAN | Whether conversation is active |
| created_at | TIMESTAMP | When conversation was created |
| updated_at | TIMESTAMP | When conversation was last updated |

**Unique Constraint**: (influencer_id, brand_id)

#### `messages`
Stores individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| conversation_id | INTEGER | Foreign key to conversations table |
| sender_type | VARCHAR(20) | Type of sender (influencer/brand) |
| influencer_id | INTEGER | Influencer ID if sender is influencer |
| brand_id | INTEGER | Brand ID if sender is brand |
| message_type | VARCHAR(20) | Type of message (text/image/file) |
| content | TEXT | Message text content |
| attachment_url | VARCHAR(500) | URL to attached file |
| attachment_name | VARCHAR(255) | Name of attached file |
| is_read | BOOLEAN | Whether message has been read |
| read_at | TIMESTAMP | When message was read |
| is_deleted | BOOLEAN | Soft delete flag |
| created_at | TIMESTAMP | When message was created |
| updated_at | TIMESTAMP | When message was last updated |

### Indexes

- `idx_conversations_influencer_id`: Fast lookup by influencer
- `idx_conversations_brand_id`: Fast lookup by brand
- `idx_conversations_last_message_at`: Sort conversations by activity
- `idx_conversations_active`: Filter active conversations
- `idx_messages_conversation_id`: Fast lookup of messages in conversation
- `idx_messages_created_at`: Sort messages chronologically
- `idx_messages_sender`: Lookup messages by sender
- `idx_messages_unread`: Filter unread messages

## API Endpoints

### Base URL: `/api/chat`

All endpoints require authentication via Bearer token.

### 1. Create or Get Conversation

**POST** `/api/chat/conversations`

Creates a new conversation or retrieves an existing one between the authenticated user and another user.

**Request Body:**
```json
{
  "otherPartyId": 123,
  "otherPartyType": "brand" // or "influencer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "influencer": {
      "id": 45,
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "profileImage": "https://..."
    },
    "brand": {
      "id": 123,
      "username": "brand_name",
      "brandName": "Brand Name",
      "profileImage": "https://..."
    },
    "lastMessage": "Hello!",
    "lastMessageAt": "2025-11-13T10:30:00Z",
    "unreadCount": 0,
    "createdAt": "2025-11-12T15:00:00Z",
    "updatedAt": "2025-11-13T10:30:00Z"
  },
  "message": "Conversation ready",
  "timestamp": "2025-11-13T10:30:15Z"
}
```

### 2. Get All Conversations

**GET** `/api/chat/conversations`

Retrieves all conversations for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": 1,
        "otherParty": {
          "id": 123,
          "username": "brand_name",
          "brandName": "Brand Name",
          "profileImage": "https://..."
        },
        "lastMessage": "Hello!",
        "lastMessageAt": "2025-11-13T10:30:00Z",
        "lastMessageSenderType": "brand",
        "unreadCount": 3,
        "createdAt": "2025-11-12T15:00:00Z",
        "updatedAt": "2025-11-13T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  },
  "message": "Conversations retrieved",
  "timestamp": "2025-11-13T10:30:15Z"
}
```

### 3. Get Messages in Conversation

**GET** `/api/chat/conversations/:id/messages`

Retrieves messages in a specific conversation.

**Path Parameters:**
- `id`: Conversation ID

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)
- `beforeMessageId` (optional): Load messages before this message ID (for pagination)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "sender": {
          "id": 123,
          "username": "brand_name",
          "brandName": "Brand Name",
          "profileImage": "https://..."
        },
        "senderType": "brand",
        "messageType": "text",
        "content": "Hello, how are you?",
        "attachmentUrl": null,
        "attachmentName": null,
        "isRead": true,
        "readAt": "2025-11-13T10:31:00Z",
        "createdAt": "2025-11-13T10:30:00Z"
      },
      {
        "id": 2,
        "sender": {
          "id": 45,
          "username": "johndoe",
          "firstName": "John",
          "lastName": "Doe",
          "profileImage": "https://..."
        },
        "senderType": "influencer",
        "messageType": "text",
        "content": "I'm good, thanks!",
        "attachmentUrl": null,
        "attachmentName": null,
        "isRead": false,
        "readAt": null,
        "createdAt": "2025-11-13T10:32:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "totalPages": 1
    }
  },
  "message": "Messages retrieved",
  "timestamp": "2025-11-13T10:35:00Z"
}
```

### 4. Send Message

**POST** `/api/chat/messages`

Sends a message in a conversation.

**Request Body:**
```json
{
  "conversationId": 1,
  "content": "Hello there!",
  "messageType": "text", // optional: "text", "image", "file"
  "attachmentUrl": "https://...", // optional
  "attachmentName": "document.pdf" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "conversationId": 1,
    "sender": {
      "id": 45,
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "profileImage": "https://..."
    },
    "senderType": "influencer",
    "messageType": "text",
    "content": "Hello there!",
    "attachmentUrl": null,
    "attachmentName": null,
    "isRead": false,
    "readAt": null,
    "createdAt": "2025-11-13T10:40:00Z"
  },
  "message": "Message sent",
  "timestamp": "2025-11-13T10:40:00Z"
}
```

### 5. Mark Messages as Read

**PUT** `/api/chat/conversations/:id/read`

Marks messages as read in a conversation.

**Path Parameters:**
- `id`: Conversation ID

**Request Body:**
```json
{
  "messageId": 10 // optional: mark all messages up to this ID as read
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": 3,
    "message": "3 message(s) marked as read"
  },
  "message": "Messages marked as read",
  "timestamp": "2025-11-13T10:45:00Z"
}
```

### 6. Get Unread Count

**GET** `/api/chat/unread-count`

Gets total unread message count across all conversations.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUnread": 12,
    "conversationsWithUnread": 5
  },
  "message": "Unread count retrieved",
  "timestamp": "2025-11-13T10:50:00Z"
}
```

### 7. Delete Conversation

**DELETE** `/api/chat/conversations/:id`

Soft deletes a conversation (sets is_active to false).

**Path Parameters:**
- `id`: Conversation ID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Conversation deleted successfully"
  },
  "message": "Conversation deleted",
  "timestamp": "2025-11-13T10:55:00Z"
}
```

## Features

### ✅ Implemented
- One-to-one messaging between influencers and brands
- Message history with pagination
- Unread message counts per conversation
- Mark messages as read
- Search conversations by name
- Soft delete conversations
- Support for text, image, and file messages
- Message attachments
- Read receipts
- Last message preview in conversation list

### 🚀 Future Enhancements (Not Implemented)
- Real-time messaging with WebSockets
- Typing indicators
- Message reactions
- Message editing/deletion
- Group chats
- Message search within conversations
- Push notifications for new messages
- Message delivery status
- Voice messages
- Video messages

## Usage Examples

### Frontend Integration

#### 1. Create a Conversation
```typescript
// When user clicks on "Message Brand" button
const createConversation = async (brandId: number) => {
  const response = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      otherPartyId: brandId,
      otherPartyType: 'brand'
    })
  });
  const data = await response.json();
  return data.data;
};
```

#### 2. Load Conversations List
```typescript
const loadConversations = async (page = 1) => {
  const response = await fetch(`/api/chat/conversations?page=${page}&limit=20`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.data.conversations;
};
```

#### 3. Load Messages
```typescript
const loadMessages = async (conversationId: number, page = 1) => {
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/messages?page=${page}&limit=50`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  const data = await response.json();
  return data.data.messages;
};
```

#### 4. Send a Message
```typescript
const sendMessage = async (conversationId: number, content: string) => {
  const response = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversationId,
      content,
      messageType: 'text'
    })
  });
  const data = await response.json();
  return data.data;
};
```

#### 5. Mark as Read
```typescript
const markAsRead = async (conversationId: number) => {
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/read`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }
  );
  return await response.json();
};
```

## Database Migration

To set up the chat system tables, run:

```bash
psql -U postgres -d incollab_db -f migrations/create_chat_system.sql
```

Or connect to your database and execute the SQL script.

## Security Considerations

1. **Authorization**: Users can only access conversations they are part of
2. **Validation**: All inputs are validated using DTOs
3. **Soft Delete**: Conversations are soft-deleted to preserve data
4. **Rate Limiting**: Consider implementing rate limiting for message sending
5. **Content Moderation**: Consider adding content filtering for inappropriate messages

## Performance Optimization

1. **Indexes**: Strategic indexes on foreign keys and frequently queried columns
2. **Pagination**: All list endpoints support pagination
3. **Selective Loading**: Only necessary fields are loaded with `attributes` parameter
4. **Unread Counts**: Maintained as denormalized fields for fast access

## Testing

Run the test suite:
```bash
npm run test
```

The chat system includes comprehensive unit tests for:
- Conversation creation
- Message sending
- Read receipts
- Unread counts
- Authorization checks

## Error Handling

Common error responses:

- **404 Not Found**: Conversation or user doesn't exist
- **403 Forbidden**: User is not a participant in the conversation
- **400 Bad Request**: Invalid input or missing required fields
- **401 Unauthorized**: Missing or invalid authentication token

## Support

For questions or issues, contact the development team or create an issue in the repository.
