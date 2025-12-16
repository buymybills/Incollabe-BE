# WebSocket Real-Time Chat Integration Guide

## Overview

The chat system now supports real-time messaging via WebSockets using Socket.IO. This allows:
- Instant message delivery
- Typing indicators
- Online/offline status
- Read receipts in real-time
- Push notifications for new messages

## Architecture

```
Frontend (React/Vue/Angular)
    ↓ Socket.IO Client
WebSocket Gateway (/chat namespace)
    ↓ Events
ChatService (Business Logic)
    ↓ Database
PostgreSQL (Messages & Conversations)
```

---

## Backend Setup (Already Done ✅)

The backend has been configured with:
1. ✅ Socket.IO installed
2. ✅ ChatGateway created at `/chat` namespace
3. ✅ WebSocket authentication guard
4. ✅ Integration with existing ChatService

---

## Frontend Integration

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
```

### 2. Connect to WebSocket Server

```javascript
import { io } from 'socket.io-client';

// Initialize connection
const socket = io('http://your-backend-url/chat', {
  auth: {
    // Temporary format for testing: "userId:userType"
    // In production, pass actual JWT token
    token: `${userId}:${userType}` // e.g., "123:influencer" or "456:brand"
  },
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Listen for connection success
socket.on('connection:success', (data) => {
  console.log('Connected to chat server:', data);
  // data: { userId, userType, socketId }
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// Handle disconnection
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

---

## WebSocket Events

### 📥 Client → Server (Emit)

#### 1. Join Conversation
```javascript
socket.emit('conversation:join', {
  conversationId: 123
});

// Listen for confirmation
socket.on('conversation:joined', (data) => {
  console.log('Joined conversation:', data);
  // data: { conversationId, room }
});
```

#### 2. Leave Conversation
```javascript
socket.emit('conversation:leave', {
  conversationId: 123
});

socket.on('conversation:left', (data) => {
  console.log('Left conversation:', data);
});
```

#### 3. Send Message
```javascript
socket.emit('message:send', {
  conversationId: 123,
  content: 'Hello!',
  messageType: 'text', // 'text', 'image', 'file'
  tempId: Date.now(), // Optional: for optimistic UI updates
  // Optional fields:
  attachmentUrl: 'https://...',
  attachmentName: 'file.pdf'
});

// Listen for sent confirmation
socket.on('message:sent', (data) => {
  console.log('Message sent:', data);
  // data: { tempId, message }
  // Use tempId to update optimistic message in UI
});

// Handle send errors
socket.on('message:error', (data) => {
  console.error('Message failed:', data);
  // data: { error, tempId }
});
```

#### 4. Mark as Read
```javascript
socket.emit('message:read', {
  conversationId: 123,
  messageId: 456 // Optional: mark all up to this message
});

socket.on('message:read:success', (data) => {
  console.log('Marked as read:', data);
});
```

#### 5. Typing Indicators
```javascript
// User starts typing
socket.emit('typing:start', {
  conversationId: 123
});

// User stops typing
socket.emit('typing:stop', {
  conversationId: 123
});
```

#### 6. Check Online Status
```javascript
socket.emit('user:check:online', {
  userId: 789,
  userType: 'brand' // or 'influencer'
});

socket.on('user:online:status', (data) => {
  console.log('User online status:', data);
  // data: { userId, userType, isOnline: true/false }
});
```

---

### 📤 Server → Client (Listen)

#### 1. Receive New Messages
```javascript
socket.on('message:new', (message) => {
  console.log('New message received:', message);
  /*
  message: {
    id: 789,
    conversationId: 123,
    sender: {
      id: 456,
      username: 'john_doe',
      firstName: 'John',
      lastName: 'Doe',
      profileImage: 'https://...'
    },
    senderType: 'influencer',
    messageType: 'text',
    content: 'Hello!',
    isRead: false,
    createdAt: '2025-11-14T...',
    attachmentUrl: null,
    attachmentName: null
  }
  */

  // Add message to your chat UI
  // Play notification sound
  // Update conversation list
});
```

#### 2. Message Read Receipts
```javascript
socket.on('message:read', (data) => {
  console.log('Messages marked as read:', data);
  /*
  data: {
    conversationId: 123,
    messageId: 456,
    readBy: {
      userId: 789,
      userType: 'brand'
    }
  }
  */

  // Update message read status in UI
  // Show double checkmarks, etc.
});
```

#### 3. Typing Indicators
```javascript
socket.on('typing:start', (data) => {
  console.log('User is typing:', data);
  // data: { conversationId, user: { userId, userType } }

  // Show "User is typing..." indicator
});

socket.on('typing:stop', (data) => {
  console.log('User stopped typing:', data);

  // Hide typing indicator
});
```

#### 4. Online/Offline Status
```javascript
socket.on('user:online', (data) => {
  console.log('User came online:', data);
  // data: { userId, userType }

  // Show green dot, update status
});

socket.on('user:offline', (data) => {
  console.log('User went offline:', data);

  // Show gray dot, update status
});
```

#### 5. Push Notifications (when user not in room)
```javascript
socket.on('message:notification', (data) => {
  console.log('New message notification:', data);
  // data: { conversationId, message }

  // Show browser notification
  // Update unread badge
  // Play sound
});
```

---

## Complete Frontend Example (React)

```javascript
import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

function ChatComponent({ userId, userType, conversationId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:3000/chat', {
      auth: {
        token: `${userId}:${userType}` // Replace with actual JWT in production
      }
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connection:success', (data) => {
      console.log('Connected:', data);
      // Join the conversation room
      socket.emit('conversation:join', { conversationId });
    });

    // Listen for new messages
    socket.on('message:new', (message) => {
      setMessages(prev => [...prev, message]);
      // Play notification sound
      new Audio('/notification.mp3').play();
    });

    // Listen for typing indicators
    socket.on('typing:start', (data) => {
      if (data.user.userId !== userId) {
        setIsTyping(true);
      }
    });

    socket.on('typing:stop', (data) => {
      if (data.user.userId !== userId) {
        setIsTyping(false);
      }
    });

    // Listen for read receipts
    socket.on('message:read', (data) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id <= data.messageId
            ? { ...msg, isRead: true, readAt: new Date() }
            : msg
        )
      );
    });

    // Cleanup on unmount
    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.disconnect();
    };
  }, [userId, userType, conversationId]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const tempId = Date.now();

    // Optimistic UI update
    const optimisticMessage = {
      id: tempId,
      content: newMessage,
      senderType: userType,
      createdAt: new Date(),
      isRead: false,
      isSending: true
    };
    setMessages(prev => [...prev, optimisticMessage]);

    // Send via WebSocket
    socketRef.current.emit('message:send', {
      conversationId,
      content: newMessage,
      messageType: 'text',
      tempId
    });

    // Clear input
    setNewMessage('');

    // Stop typing indicator
    socketRef.current.emit('typing:stop', { conversationId });
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    // Send typing start
    socketRef.current.emit('typing:start', { conversationId });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing stop after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('typing:stop', { conversationId });
    }, 2000);
  };

  const handleMarkAsRead = (messageId) => {
    socketRef.current.emit('message:read', {
      conversationId,
      messageId
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Conversation {conversationId}</h3>
        {isOnline && <span className="online-indicator">● Online</span>}
      </div>

      <div className="messages-container">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.senderType === userType ? 'sent' : 'received'}`}>
            <p>{msg.content}</p>
            <span className="timestamp">{new Date(msg.createdAt).toLocaleTimeString()}</span>
            {msg.isRead && <span className="read-receipt">✓✓</span>}
          </div>
        ))}
        {isTyping && <div className="typing-indicator">Typing...</div>}
      </div>

      <div className="message-input">
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatComponent;
```

---

## REST API Endpoints (Still Available)

The existing REST API endpoints are still fully functional and can be used alongside WebSockets:

- `POST /api/chat/conversations` - Create conversation
- `GET /api/chat/conversations` - Get all conversations
- `GET /api/chat/conversations/:id/messages` - Get messages
- `POST /api/chat/messages` - Send message (HTTP)
- `PUT /api/chat/conversations/:id/read` - Mark as read
- `GET /api/chat/unread-count` - Get unread count
- `DELETE /api/chat/conversations/:id` - Delete conversation

Use REST APIs for:
- Initial data loading (conversations list, message history)
- Pagination
- Search
- File uploads (send attachmentUrl via WebSocket after upload)

---

## Testing WebSocket Connection

### Using Browser Console

```javascript
const socket = io('http://localhost:3000/chat', {
  auth: { token: '1:influencer' }
});

socket.on('connection:success', (data) => console.log('Connected:', data));
socket.emit('conversation:join', { conversationId: 1 });
socket.emit('message:send', { conversationId: 1, content: 'Test message' });
socket.on('message:new', (msg) => console.log('New message:', msg));
```

### Using Postman/Thunder Client

Postman supports WebSocket testing:
1. Create new WebSocket request
2. URL: `ws://localhost:3000/chat`
3. Connect
4. Send events as JSON

---

## Security Considerations

### Current Implementation (Development)
- Token format: `userId:userType` for easy testing
- ⚠️ **Not secure for production**

### Production Implementation (TODO)
1. **Use proper JWT authentication:**
   ```javascript
   // Frontend
   const token = localStorage.getItem('accessToken');
   const socket = io('http://your-api.com/chat', {
     auth: { token: `Bearer ${token}` }
   });
   ```

2. **Update `extractUserFromToken()` in `chat.gateway.ts`:**
   ```typescript
   constructor(
     private readonly chatService: ChatService,
     private readonly jwtService: JwtService, // Inject JwtService
   ) {}

   private extractUserFromToken(token: string) {
     try {
       const tokenValue = token.replace('Bearer ', '');
       const decoded = this.jwtService.verify(tokenValue);
       return {
         userId: decoded.sub,
         userType: decoded.userType
       };
     } catch (error) {
       return null;
     }
   }
   ```

3. **Add rate limiting** to prevent spam
4. **Validate all incoming messages** before broadcasting
5. **Use CORS** properly (don't use `origin: '*'` in production)

---

## Deployment Notes

### Environment Variables

No new environment variables needed. The WebSocket server runs on the same port as your HTTP server.

### NGINX Configuration (if using reverse proxy)

```nginx
location /socket.io/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### PM2 Configuration

WebSockets work with PM2 clustering, but you need to enable sticky sessions:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: 'dist/main.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Or use Redis adapter for Socket.IO (recommended for multi-instance):

```bash
npm install @socket.io/redis-adapter redis
```

---

## Troubleshooting

### Issue: Client can't connect

**Solution:**
- Check if WebSocket port is open
- Verify CORS settings
- Check browser console for errors
- Ensure token is being sent correctly

### Issue: Messages not received in real-time

**Solution:**
- Check if user joined conversation room
- Verify both users are connected
- Check server logs for errors

### Issue: Typing indicator not working

**Solution:**
- Make sure `typing:start` and `typing:stop` are emitted
- Check if events are reaching the server (check logs)
- Verify room membership

---

## Next Steps

1. ✅ Backend WebSocket setup complete
2. ⬜ Implement frontend Socket.IO client
3. ⬜ Add proper JWT authentication
4. ⬜ Implement Redis adapter for multi-instance support
5. ⬜ Add rate limiting
6. ⬜ Implement file upload progress tracking
7. ⬜ Add message delivery confirmation
8. ⬜ Implement message encryption (optional)

---

## Support

For questions or issues, check:
- Socket.IO documentation: https://socket.io/docs/v4/
- NestJS WebSockets: https://docs.nestjs.com/websockets/gateways

Happy coding! 🚀
