import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { SendMessageDto, MarkAsReadDto, TypingDto } from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL in production
    credentials: true,
  },
  namespace: '/chat',
  // Ping-pong configuration for connection health monitoring
  pingTimeout: 60000, // 60 seconds - disconnect if no pong received
  pingInterval: 25000, // 25 seconds - send ping every 25s
  upgradeTimeout: 30000, // 30 seconds - timeout for connection upgrade
  maxHttpBufferSize: 1e6, // 1MB - max message size
  transports: ['websocket', 'polling'], // Allow both transports
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private userSockets: Map<string, Socket> = new Map(); // userId:userType -> socket

  // Track connection health with heartbeat intervals
  private heartbeats: Map<string, NodeJS.Timeout> = new Map();

  // Rate limiting: userId:userType -> { count, resetTime }
  private messageRateLimits: Map<string, { count: number; resetTime: number }> =
    new Map();

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Setup server-level error handling (if engine is available)
    if (server.engine) {
      server.engine.on('connection_error', (err) => {
        this.logger.error('Connection error:', err);
      });
    }

    // Clean up stale rate limit entries every 5 minutes
    setInterval(
      () => {
        this.cleanupRateLimits();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Extract auth token from handshake
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      // Validate token and extract user info
      // Note: You'll need to inject your JWT service/auth service to validate
      // For now, we'll assume the token is passed as "userId:userType:jwtToken"
      // In production, properly validate JWT token

      const user = this.extractUserFromToken(token);
      if (!user) {
        this.logger.warn(`Client ${client.id} rejected: Invalid token`);
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect(true);
        return;
      }

      // Store user data in socket
      client.data.userId = user.userId;
      client.data.userType = user.userType;
      client.data.connectedAt = Date.now();

      const userKey = `${user.userId}:${user.userType}`;

      // Disconnect previous connection if exists (single device policy)
      const existingSocket = this.userSockets.get(userKey);
      if (existingSocket && existingSocket.id !== client.id) {
        this.logger.log(
          `Disconnecting previous connection for user ${userKey}`,
        );
        existingSocket.emit('connection:replaced', {
          message: 'New connection established from another device',
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
        `Client connected: ${client.id} (User: ${user.userId}, Type: ${user.userType})`,
      );

      // Notify user is online
      client.broadcast.emit('user:online', {
        userId: user.userId,
        userType: user.userType,
      });

      // Send connection success to client
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

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const userType = client.data.userType;

    if (userId && userType) {
      const userKey = `${userId}:${userType}`;

      // Clear heartbeat
      this.clearHeartbeat(userKey);

      // Only remove if this is the current socket (not replaced)
      const currentSocket = this.userSockets.get(userKey);
      if (currentSocket?.id === client.id) {
        this.userSockets.delete(userKey);

        // Notify user is offline
        client.broadcast.emit('user:offline', {
          userId,
          userType,
        });
      }

      // Log connection duration
      const duration = Date.now() - (client.data.connectedAt || Date.now());
      this.logger.log(
        `Client disconnected: ${client.id} (User: ${userId}, Duration: ${Math.round(duration / 1000)}s)`,
      );
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  /**
   * Join a conversation room
   */
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    try {
      const { conversationId } = data;
      const userId = client.data.userId;
      const userType = client.data.userType;

      if (!userId || !userType) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Verify user is part of this conversation
      // This should be done in your chat service
      const roomName = `conversation_${conversationId}`;
      await client.join(roomName);

      this.logger.log(
        `User ${userId} (${userType}) joined conversation ${conversationId}`,
      );

      client.emit('conversation:joined', {
        conversationId,
        room: roomName,
      });
    } catch (error) {
      this.logger.error(`Join conversation error: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Leave a conversation room
   */
  @SubscribeMessage('conversation:leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    const { conversationId } = data;
    const roomName = `conversation_${conversationId}`;
    await client.leave(roomName);

    this.logger.log(
      `User ${client.data.userId} left conversation ${conversationId}`,
    );

    client.emit('conversation:left', { conversationId });
  }

  /**
   * Send a message in real-time
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

      // Save message using existing chat service
      const message = await this.chatService.sendMessage(userId, userType, dto);

      // Get the actual conversationId from the message (in case it was auto-created)
      const conversationId = message.conversationId;

      // Emit to conversation room (both sender and receiver)
      const roomName = `conversation_${conversationId}`;
      this.server.to(roomName).emit('message:new', message);

      // Also send direct notification to the other user if they're not in the room
      this.notifyUserDirectly(
        conversationId,
        userId,
        userType,
        'message:notification',
        {
          conversationId,
          message,
        },
      );

      this.logger.log(
        `Message sent by ${userId} (${userType}) in conversation ${conversationId}`,
      );

      // Acknowledge to sender
      client.emit('message:sent', {
        tempId: dto['tempId'], // Frontend can send tempId for optimistic UI
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
   * Mark messages as read
   */
  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MarkAsReadDto,
  ) {
    try {
      const userId = client.data.userId;
      const userType = client.data.userType;

      if (!userId || !userType) {
        throw new UnauthorizedException('User not authenticated');
      }

      const result = await this.chatService.markAsRead(userId, userType, dto);

      // Notify conversation room
      const roomName = `conversation_${dto.conversationId}`;
      this.server.to(roomName).emit('message:read', {
        conversationId: dto.conversationId,
        messageId: dto.messageId,
        readBy: {
          userId,
          userType,
        },
      });

      client.emit('message:read:success', result);
    } catch (error) {
      this.logger.error(`Mark as read error: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Handle typing indicator
   */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ) {
    const { conversationId } = data;
    const userId = client.data.userId;
    const userType = client.data.userType;

    // Emit to conversation room (excluding sender)
    const roomName = `conversation_${conversationId}`;
    client.to(roomName).emit('typing:start', {
      conversationId,
      user: {
        userId,
        userType,
      },
    });
  }

  /**
   * Handle stop typing
   */
  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ) {
    const { conversationId } = data;
    const userId = client.data.userId;
    const userType = client.data.userType;

    // Emit to conversation room (excluding sender)
    const roomName = `conversation_${conversationId}`;
    client.to(roomName).emit('typing:stop', {
      conversationId,
      user: {
        userId,
        userType,
      },
    });
  }

  /**
   * Get online status of a user
   */
  @SubscribeMessage('user:check:online')
  handleCheckOnline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number; userType: string },
  ) {
    const userKey = `${data.userId}:${data.userType}`;
    const isOnline = this.userSockets.has(userKey);

    client.emit('user:online:status', {
      userId: data.userId,
      userType: data.userType,
      isOnline,
    });
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
      `Heartbeat from ${userId}:${userType}, latency: ${latency}ms`,
    );
  }

  /**
   * Handle explicit ping from client
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }

  /**
   * Helper: Extract user from token
   * TODO: Implement proper JWT validation
   */
  private extractUserFromToken(token: string): {
    userId: number;
    userType: 'influencer' | 'brand';
  } | null {
    try {
      // Temporary implementation - replace with proper JWT validation
      // Expected format: "Bearer userId:userType" or just the JWT token

      // For now, assuming token format is "userId:userType" for testing
      // In production, decode and validate JWT token properly
      const tokenParts = token.replace('Bearer ', '').split(':');
      if (tokenParts.length >= 2) {
        return {
          userId: parseInt(tokenParts[0]),
          userType: tokenParts[1] as 'influencer' | 'brand',
        };
      }

      // TODO: Add proper JWT validation here
      // const decoded = this.jwtService.verify(token);
      // return { userId: decoded.sub, userType: decoded.userType };

      return null;
    } catch (error) {
      this.logger.error(`Token extraction error: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper: Notify a specific user directly
   * Works with all conversation types (influencer-influencer, brand-brand, influencer-brand)
   */
  private async notifyUserDirectly(
    conversationId: number,
    senderUserId: number,
    senderUserType: string,
    event: string,
    data: any,
  ) {
    try {
      // Get conversation to find the other user
      const conversation =
        await this.chatService['conversationModel'].findByPk(conversationId);

      if (!conversation) return;

      // Determine the recipient using new participant fields
      let recipientUserId: number;
      let recipientUserType: string;

      // Check if sender is participant1 or participant2
      if (
        conversation.participant1Type === senderUserType &&
        conversation.participant1Id === senderUserId
      ) {
        // Sender is participant1, so recipient is participant2
        recipientUserId = conversation.participant2Id;
        recipientUserType = conversation.participant2Type;
      } else if (
        conversation.participant2Type === senderUserType &&
        conversation.participant2Id === senderUserId
      ) {
        // Sender is participant2, so recipient is participant1
        recipientUserId = conversation.participant1Id;
        recipientUserType = conversation.participant1Type;
      } else {
        // Sender not in conversation - shouldn't happen but handle gracefully
        this.logger.warn(
          `Sender ${senderUserId}:${senderUserType} not in conversation ${conversationId}`,
        );
        return;
      }

      const userKey = `${recipientUserId}:${recipientUserType}`;
      const recipientSocket = this.userSockets.get(userKey);

      if (recipientSocket) {
        recipientSocket.emit(event, data);
        this.logger.debug(
          `Sent ${event} to ${recipientUserId}:${recipientUserType}`,
        );
      } else {
        this.logger.debug(
          `Recipient ${recipientUserId}:${recipientUserType} not online`,
        );
      }
    } catch (error) {
      this.logger.error(`Direct notification error: ${error.message}`);
    }
  }

  /**
   * Setup heartbeat monitoring for a connected client
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
   * Clear heartbeat for a user
   */
  private clearHeartbeat(userKey: string) {
    const interval = this.heartbeats.get(userKey);
    if (interval) {
      clearInterval(interval);
      this.heartbeats.delete(userKey);
    }
  }

  /**
   * Setup ping-pong handlers for connection health
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
   * Check rate limit for message sending
   * Limit: 10 messages per 10 seconds
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
      if (now > value.resetTime + 60000) {
        // 1 minute grace period
        this.messageRateLimits.delete(key);
      }
    }
    this.logger.debug(
      `Cleaned up rate limits. Remaining: ${this.messageRateLimits.size}`,
    );
  }
}
