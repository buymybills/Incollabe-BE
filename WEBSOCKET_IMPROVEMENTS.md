# WebSocket Connection Management & Error Handling

## Issues with Current Implementation

### 1. No Heartbeat/Ping-Pong ❌
- Dead connections aren't detected
- Server thinks client is connected even if network is down
- Wastes server resources

### 2. No Connection Timeout ❌
- Idle connections stay open forever
- Memory leak potential

### 3. No Reconnection Strategy ❌
- Client doesn't automatically reconnect
- Poor user experience on network issues

### 4. No Rate Limiting ❌
- Can be spammed with messages
- DoS attack vector

---

## Implementation Guide

### Step 1: Add Ping-Pong & Connection Timeout

Update `src/shared/chat.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/chat',
  // Add ping-pong configuration
  pingTimeout: 60000,      // 60 seconds - disconnect if no pong received
  pingInterval: 25000,     // 25 seconds - send ping every 25s
  upgradeTimeout: 30000,   // 30 seconds - timeout for connection upgrade
  maxHttpBufferSize: 1e6,  // 1MB - max message size
  transports: ['websocket', 'polling'], // Allow both transports
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private userSockets: Map<string, Socket> = new Map();

  // Track connection health
  private heartbeats: Map<string, NodeJS.Timeout> = new Map();

  // Rate limiting: userId:userType -> message count
  private messageRateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Setup server-level ping-pong
    server.engine.on('connection_error', (err) => {
      this.logger.error('Connection error:', err);
    });

    // Clean up stale rate limit entries every 5 minutes
    setInterval(() => {
      this.cleanupRateLimits();
    }, 5 * 60 * 1000);
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Extract and validate token
      const token = client.handshake.auth.token || client.handshake.headers.authorization;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const user = this.extractUserFromToken(token);
      if (!user) {
        this.logger.warn(`Client ${client.id} rejected: Invalid token`);
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect(true);
        return;
      }

      // Store user data
      client.data.userId = user.userId;
      client.data.userType = user.userType;
      client.data.connectedAt = Date.now();

      const userKey = `${user.userId}:${user.userType}`;

      // Disconnect previous connection if exists
      const existingSocket = this.userSockets.get(userKey);
      if (existingSocket && existingSocket.id !== client.id) {
        this.logger.log(`Disconnecting previous connection for user ${userKey}`);
        existingSocket.emit('connection:replaced', {
          message: 'New connection established from another device'
        });
        existingSocket.disconnect(true);
      }

      // Store new connection
      this.userSockets.set(userKey, client);

      // Setup heartbeat monitoring
      this.setupHeartbeat(client, userKey);

      // Setup ping-pong handlers
      this.setupPingPong(client, userKey);

      this.logger.log(
        `Client connected: ${client.id} (User: ${user.userId}, Type: ${user.userType})`
      );

      // Notify others
      client.broadcast.emit('user:online', {
        userId: user.userId,
        userType: user.userType,
      });

      // Confirm connection
      client.emit('connection:success', {
        userId: user.userId,
        userType: user.userType,
        socketId: client.id,
        serverTime: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const userType = client.data.userType;

    if (userId && userType) {
      const userKey = `${userId}:${userType}`;

      // Clear heartbeat
      this.clearHeartbeat(userKey);

      // Only remove if this is the current socket
      const currentSocket = this.userSockets.get(userKey);
      if (currentSocket?.id === client.id) {
        this.userSockets.delete(userKey);

        // Notify others
        client.broadcast.emit('user:offline', {
          userId,
          userType,
        });
      }

      const duration = Date.now() - (client.data.connectedAt || Date.now());
      this.logger.log(
        `Client disconnected: ${client.id} (User: ${userId}, Duration: ${Math.round(duration / 1000)}s)`
      );
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  /**
   * Setup heartbeat monitoring
   */
  private setupHeartbeat(client: Socket, userKey: string) {
    // Clear existing heartbeat if any
    this.clearHeartbeat(userKey);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (client.connected) {
        client.emit('heartbeat', { timestamp: Date.now() });
      } else {
        this.clearHeartbeat(userKey);
      }
    }, 30000);

    this.heartbeats.set(userKey, heartbeatInterval);
  }

  /**
   * Setup ping-pong handlers
   */
  private setupPingPong(client: Socket, userKey: string) {
    client.on('ping', () => {
      client.emit('pong', { timestamp: Date.now() });
    });

    client.on('pong', () => {
      this.logger.debug(`Pong received from ${userKey}`);
    });
  }

  /**
   * Clear heartbeat
   */
  private clearHeartbeat(userKey: string) {
    const interval = this.heartbeats.get(userKey);
    if (interval) {
      clearInterval(interval);
      this.heartbeats.delete(userKey);
    }
  }

  /**
   * Rate limiting for messages
   */
  private checkRateLimit(userKey: string): boolean {
    const now = Date.now();
    const limit = this.messageRateLimits.get(userKey);

    // Rate limit: 10 messages per 10 seconds
    const MAX_MESSAGES = 10;
    const WINDOW_MS = 10000;

    if (!limit || now > limit.resetTime) {
      // Reset or create new limit
      this.messageRateLimits.set(userKey, {
        count: 1,
        resetTime: now + WINDOW_MS,
      });
      return true;
    }

    if (limit.count >= MAX_MESSAGES) {
      return false; // Rate limit exceeded
    }

    limit.count++;
    return true;
  }

  /**
   * Clean up old rate limit entries
   */
  private cleanupRateLimits() {
    const now = Date.now();
    for (const [key, value] of this.messageRateLimits.entries()) {
      if (now > value.resetTime + 60000) { // 1 minute grace period
        this.messageRateLimits.delete(key);
      }
    }
  }

  /**
   * Enhanced message sending with rate limiting
   */
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    try {
      const userId = client.data.userId;
      const userType = client.data.userType;

      if (!userId || !userType) {
        throw new UnauthorizedException('User not authenticated');
      }

      const userKey = `${userId}:${userType}`;

      // Check rate limit
      if (!this.checkRateLimit(userKey)) {
        client.emit('message:error', {
          error: 'Rate limit exceeded. Please slow down.',
          tempId: dto['tempId'],
        });
        this.logger.warn(`Rate limit exceeded for ${userKey}`);
        return;
      }

      // Save message
      const message = await this.chatService.sendMessage(userId, userType, dto);

      const conversationId = message.conversationId;
      const roomName = `conversation_${conversationId}`;

      // Emit to room
      this.server.to(roomName).emit('message:new', message);

      // Direct notification
      this.notifyUserDirectly(conversationId, userId, userType, 'message:notification', {
        conversationId,
        message,
      });

      this.logger.log(`Message sent by ${userId} in conversation ${conversationId}`);

      // Acknowledge
      client.emit('message:sent', {
        tempId: dto['tempId'],
        message,
      });
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`, error.stack);
      client.emit('message:error', {
        error: error.message,
        tempId: dto['tempId'],
      });
    }
  }

  /**
   * Handle heartbeat response from client
   */
  @SubscribeMessage('heartbeat:response')
  handleHeartbeatResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { timestamp: number },
  ) {
    const userId = client.data.userId;
    const userType = client.data.userType;
    const latency = Date.now() - data.timestamp;

    this.logger.debug(
      `Heartbeat from ${userId}:${userType}, latency: ${latency}ms`
    );
  }

  /**
   * Handle explicit ping from client
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }
}
```

### Step 2: Update Socket.IO Server Configuration

Update `main.ts` if you have Socket.IO configuration there:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure Socket.IO
  const io = app.get('io'); // If you have custom setup

  // Or configure via adapter
  app.useWebSocketAdapter(new SocketIoAdapter(app, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6,
  }));

  await app.listen(3002);
}
bootstrap();
```

### Step 3: Client-Side Reconnection Logic

```javascript
// frontend/services/socketService.js
import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) {
      console.log('Already connected');
      return this.socket;
    }

    this.socket = io('http://localhost:3002/chat', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: true,
    });

    this.setupEventHandlers();

    return this.socket;
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emit('connection:established');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
      this.emit('connection:lost', { reason });

      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      this.reconnectAttempts++;

      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);

      this.emit('connection:error', {
        error: error.message,
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.emit('connection:failed');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.emit('connection:reconnected', { attemptNumber });
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}...`);
      this.emit('connection:reconnecting', { attemptNumber });
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      this.emit('connection:failed');
    });

    // Heartbeat
    this.socket.on('heartbeat', (data) => {
      this.socket.emit('heartbeat:response', data);
    });

    // Connection replaced
    this.socket.on('connection:replaced', (data) => {
      console.warn('Connection replaced:', data.message);
      this.emit('connection:replaced', data);
    });

    // Errors
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('error', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event emitter for UI
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => callback(data));
  }

  // Message sending with retry
  async sendMessage(data, retries = 3) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Not connected'));
        return;
      }

      let attempts = 0;
      const attemptSend = () => {
        attempts++;

        this.socket.emit('message:send', data, (response) => {
          if (response?.error && attempts < retries) {
            console.log(`Retry ${attempts}/${retries}...`);
            setTimeout(attemptSend, 1000 * attempts);
          } else if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      };

      attemptSend();
    });
  }
}

export default new SocketService();
```

### Step 4: React Component with Connection Status

```jsx
// ConnectionStatus.jsx
import React, { useEffect, useState } from 'react';
import socketService from '../services/socketService';

function ConnectionStatus() {
  const [status, setStatus] = useState('disconnected');
  const [reconnecting, setReconnecting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    socketService.on('connection:established', () => {
      setStatus('connected');
      setReconnecting(false);
    });

    socketService.on('connection:lost', () => {
      setStatus('disconnected');
    });

    socketService.on('connection:reconnecting', ({ attemptNumber }) => {
      setStatus('reconnecting');
      setReconnecting(true);
      setAttempts(attemptNumber);
    });

    socketService.on('connection:reconnected', () => {
      setStatus('connected');
      setReconnecting(false);
      setAttempts(0);
    });

    socketService.on('connection:failed', () => {
      setStatus('failed');
      setReconnecting(false);
    });

    socketService.on('connection:error', ({ attempts: errorAttempts }) => {
      setAttempts(errorAttempts);
    });

    return () => {
      // Cleanup listeners
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'green';
      case 'reconnecting': return 'orange';
      case 'disconnected': return 'gray';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return '🟢 Connected';
      case 'reconnecting': return `🟡 Reconnecting (${attempts})...`;
      case 'disconnected': return '⚫ Disconnected';
      case 'failed': return '🔴 Connection Failed';
      default: return 'Unknown';
    }
  };

  return (
    <div className="connection-status" style={{ color: getStatusColor() }}>
      {getStatusText()}
    </div>
  );
}

export default ConnectionStatus;
```

---

## Configuration Summary

### Server-Side Settings

```typescript
@WebSocketGateway({
  pingTimeout: 60000,      // Disconnect if no pong in 60s
  pingInterval: 25000,     // Send ping every 25s
  upgradeTimeout: 30000,   // Connection upgrade timeout
  maxHttpBufferSize: 1e6,  // 1MB max message size
})
```

### Client-Side Settings

```javascript
io('url', {
  reconnection: true,           // Enable auto-reconnect
  reconnectionAttempts: 5,      // Try 5 times
  reconnectionDelay: 1000,      // Start with 1s delay
  reconnectionDelayMax: 10000,  // Max 10s delay
  timeout: 20000,               // 20s connection timeout
})
```

---

## Testing

### Test 1: Connection Health

```bash
# Monitor WebSocket connections
# In server logs, you should see:
# - Heartbeat every 30s
# - Ping-pong every 25s
```

### Test 2: Disconnection Handling

```javascript
// In browser console
socketService.socket.disconnect();
// Should see reconnection attempts
```

### Test 3: Rate Limiting

```javascript
// Send 11 messages quickly
for (let i = 0; i < 11; i++) {
  socketService.sendMessage({ content: `Test ${i}` });
}
// Should see rate limit error on 11th message
```

### Test 4: Network Interruption

```bash
# Disable network
# Enable network after 30 seconds
# Client should automatically reconnect
```

---

## Monitoring & Metrics

Add to your gateway:

```typescript
@SubscribeMessage('metrics:request')
handleMetricsRequest(@ConnectedSocket() client: Socket) {
  client.emit('metrics:response', {
    connectedUsers: this.userSockets.size,
    heartbeats: this.heartbeats.size,
    rateLimitEntries: this.messageRateLimits.size,
    uptime: process.uptime(),
  });
}
```

---

## Summary Checklist

### Server-Side ✅
- [x] Ping-pong configuration
- [x] Heartbeat mechanism
- [x] Connection timeout
- [x] Rate limiting
- [x] Proper disconnect handling
- [x] Error logging
- [x] Multiple device handling

### Client-Side ✅
- [x] Auto-reconnection
- [x] Exponential backoff
- [x] Connection status UI
- [x] Error handling
- [x] Heartbeat response
- [x] Message retry logic

**Your WebSocket is now production-ready!** 🚀
