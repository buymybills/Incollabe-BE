# Push Notification Implementation for Offline Users

## Overview
When a user receives a message while offline, they should get a push notification on their mobile device.

## Current Status
✅ **FCM Token Storage**: Already implemented in database
- `influencers.fcmToken`
- `brands.fcmToken`

❌ **Push Notification Sending**: Not implemented yet

---

## Implementation Steps

### 1. Install Firebase Admin SDK

```bash
npm install firebase-admin
```

### 2. Create Push Notification Service

Create `src/shared/push-notification.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class PushNotificationService {
  private firebaseApp: admin.app.App;

  constructor() {
    // Initialize Firebase Admin
    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  async sendMessageNotification(
    fcmToken: string,
    senderName: string,
    messagePreview: string,
    conversationId: number,
  ) {
    if (!fcmToken) {
      console.log('No FCM token available for user');
      return;
    }

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: `New message from ${senderName}`,
          body: messagePreview,
        },
        data: {
          type: 'new_message',
          conversationId: conversationId.toString(),
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'chat_messages',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Push notification sent successfully:', response);
      return response;
    } catch (error) {
      console.error('Error sending push notification:', error);
      // If token is invalid, you might want to remove it from database
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        console.log('Invalid FCM token, should be removed from database');
      }
    }
  }

  async sendUnreadCountUpdate(fcmToken: string, unreadCount: number) {
    if (!fcmToken) return;

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        data: {
          type: 'unread_count_update',
          unreadCount: unreadCount.toString(),
        },
      };

      await admin.messaging().send(message);
    } catch (error) {
      console.error('Error sending unread count notification:', error);
    }
  }
}
```

### 3. Update Chat Service to Send Notifications

Modify `src/shared/chat.service.ts`:

```typescript
import { PushNotificationService } from './push-notification.service';

export class ChatService {
  constructor(
    // ... existing dependencies
    private pushNotificationService: PushNotificationService,
  ) {}

  async sendMessage(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: SendMessageDto,
  ) {
    // ... existing message creation code

    // After saving message, check if recipient is online
    const isRecipientOnline = await this.checkIfUserOnline(
      otherParticipant.id,
      otherParticipant.type,
    );

    if (!isRecipientOnline) {
      // Send push notification
      const recipientFcmToken = await this.getRecipientFcmToken(
        otherParticipant.id,
        otherParticipant.type,
      );

      if (recipientFcmToken) {
        const senderDetails = await this.getParticipantDetails(
          userParticipantType,
          userId,
        );

        const senderName =
          userType === 'influencer'
            ? senderDetails.name
            : senderDetails.brandName;

        // Create message preview
        let messagePreview: string;
        if (message.isEncrypted) {
          messagePreview = '🔒 Sent an encrypted message';
        } else if (message.attachmentUrl) {
          messagePreview = `Sent a ${message.messageType}`;
        } else {
          messagePreview = message.content?.substring(0, 100) || 'Sent a message';
        }

        await this.pushNotificationService.sendMessageNotification(
          recipientFcmToken,
          senderName,
          messagePreview,
          actualConversationId,
        );
      }
    }

    return message;
  }

  private async checkIfUserOnline(
    userId: number,
    userType: string,
  ): Promise<boolean> {
    // Check if user has active WebSocket connection
    // This requires integration with chat.gateway.ts
    // For now, return false (assume offline)
    return false;
  }

  private async getRecipientFcmToken(
    userId: number,
    userType: string,
  ): Promise<string | null> {
    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId, {
        attributes: ['fcmToken'],
      });
      return influencer?.fcmToken || null;
    } else {
      const brand = await this.brandModel.findByPk(userId, {
        attributes: ['fcmToken'],
      });
      return brand?.fcmToken || null;
    }
  }
}
```

### 4. Update Chat Module

Add the service to `src/shared/shared.module.ts`:

```typescript
import { PushNotificationService } from './push-notification.service';

@Module({
  providers: [
    ChatService,
    PushNotificationService,
    // ... other providers
  ],
})
export class SharedModule {}
```

### 5. Environment Variables

Add to `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 6. Track Online Users (Optional Enhancement)

Modify `src/shared/chat.gateway.ts`:

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class OnlineUsersService {
  private onlineUsers = new Map<string, Set<string>>(); // userId:userType -> Set of socketIds

  addUser(userId: number, userType: string, socketId: string) {
    const key = `${userId}:${userType}`;
    if (!this.onlineUsers.has(key)) {
      this.onlineUsers.set(key, new Set());
    }
    this.onlineUsers.get(key)!.add(socketId);
  }

  removeUser(userId: number, userType: string, socketId: string) {
    const key = `${userId}:${userType}`;
    const sockets = this.onlineUsers.get(key);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.onlineUsers.delete(key);
      }
    }
  }

  isUserOnline(userId: number, userType: string): boolean {
    const key = `${userId}:${userType}`;
    return this.onlineUsers.has(key) && this.onlineUsers.get(key)!.size > 0;
  }
}
```

Update gateway to track connections:

```typescript
@WebSocketGateway({ namespace: '/chat', cors: true })
export class ChatGateway {
  constructor(
    private onlineUsersService: OnlineUsersService,
  ) {}

  handleConnection(client: Socket) {
    const { userId, userType } = client.data;
    this.onlineUsersService.addUser(userId, userType, client.id);
  }

  handleDisconnect(client: Socket) {
    const { userId, userType } = client.data;
    this.onlineUsersService.removeUser(userId, userType, client.id);
  }
}
```

---

## Testing Push Notifications

### 1. Get FCM Token from Mobile App

Your mobile app needs to register for push notifications and send the token:

```typescript
// Mobile app code (React Native / Flutter)
const fcmToken = await messaging().getToken();

// Send to backend
PUT /api/influencer/profile
{
  "fcmToken": "dKx7gH3..."
}
```

### 2. Test Notification

```bash
# User A sends message to offline User B
curl -X POST 'http://localhost:3002/api/chat/messages' \
  -H 'Authorization: Bearer <USER_A_TOKEN>' \
  -d '{
    "otherPartyId": 12,
    "otherPartyType": "influencer",
    "content": "Test notification!"
  }'
```

User B should receive a push notification on their mobile device!

---

## Notification Types

### 1. New Message
```json
{
  "title": "New message from John Doe",
  "body": "Hey! Are you there?",
  "data": {
    "type": "new_message",
    "conversationId": "1"
  }
}
```

### 2. Unread Count Update
```json
{
  "data": {
    "type": "unread_count_update",
    "unreadCount": "5"
  }
}
```

### 3. Message Read Receipt
```json
{
  "data": {
    "type": "message_read",
    "conversationId": "1",
    "messageId": "42"
  }
}
```

---

## Best Practices

1. ✅ **Always save to database first** - Don't rely on real-time delivery
2. ✅ **Track unread counts** - Show badge on app icon
3. ✅ **Send push notifications** - For offline users
4. ✅ **Emit WebSocket events** - For online users
5. ✅ **Handle failed notifications** - Remove invalid FCM tokens
6. ✅ **Rate limiting** - Don't spam users with too many notifications
7. ✅ **Notification preferences** - Let users mute conversations

---

## Summary

**Current Flow (Without Push):**
```
Send Message → Save to DB → Try WebSocket → ❌ User Offline → Nothing happens
```

**Improved Flow (With Push):**
```
Send Message → Save to DB → Check if online
                           ├─ Online → Send WebSocket event ✅
                           └─ Offline → Send Push Notification ✅
```

When user comes back online:
```
Open App → Fetch conversations → See unread count → Fetch messages → Read!
```
