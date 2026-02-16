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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ParticipantType } from './models/conversation.model';
import { NotificationService } from './notification.service';
import { DeviceTokenService } from './device-token.service';
import { UserType as DeviceUserType } from './models/device-token.model';

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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private userSockets: Map<string, Socket> = new Map();
  private heartbeats: Map<string, NodeJS.Timeout> = new Map();
  private messageRateLimits: Map<string, { count: number; resetTime: number }> =
    new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
  ) { }

  afterInit(server: Server) {
    console.log('\n🚀 ===== WEBSOCKET GATEWAY INITIALIZED =====');
    console.log('Namespace: /chat');
    console.log('CORS: Enabled for all origins');
    console.log('Transports: websocket, polling');
    console.log('Ping Interval: 25 seconds');
    console.log('Ping Timeout: 60 seconds');
    console.log('===========================================\n');

    this.logger.log('WebSocket Gateway initialized');

    // Setup server-level error handling (if engine is available)
    if (server.engine) {
      server.engine.on('connection_error', (err) => {
        console.error('🔴 Engine Connection Error:', err);
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
      console.log('=== NEW SOCKET CONNECTION ATTEMPT ===');
      console.log('Client ID:', client.id);
      console.log('Client IP:', client.handshake.address);
      console.log('Client Headers:', JSON.stringify(client.handshake.headers, null, 2));
      console.log('Client Auth:', JSON.stringify(client.handshake.auth, null, 2));
      console.log('Client Query:', JSON.stringify(client.handshake.query, null, 2));

      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Extract auth token from handshake
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization;

      console.log('Extracted Token:', token ? `${token.substring(0, 20)}...` : 'NULL');

      if (!token) {
        console.error('❌ REJECTED: No token provided');
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

      console.log('User Extraction Result:', user);

      if (!user) {
        console.error('❌ REJECTED: Invalid token - could not extract user');
        this.logger.warn(`Client ${client.id} rejected: Invalid token`);
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect(true);
        return;
      }

      console.log('✅ Token Valid - User:', user.userId, 'Type:', user.userType);

      // Store user data in socket
      client.data.userId = user.userId;
      client.data.userType = user.userType;
      client.data.connectedAt = Date.now();

      const userKey = `${user.userId}:${user.userType}`;
      console.log('User Key:', userKey);

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
      // this.setupPingPong(client, userKey);

      console.log('✅ CONNECTION SUCCESSFUL');
      console.log('Total Connected Users:', this.userSockets.size);
      console.log('=====================================\n');

      this.logger.log(
        `Client connected: ${client.id} (User: ${user.userId}, Type: ${user.userType})`,
      );

      // Notify user is online
      client.broadcast.emit('user:online', {
        userId: user.userId,
        userType: user.userType,
      });

      console.log('Broadcasting user:online event for:', userKey);

      // Send connection success to client
      client.emit('connection:success', {
        userId: user.userId,
        userType: user.userType,
        socketId: client.id,
        serverTime: Date.now(),
      });

      console.log('Sent connection:success to client');

    } catch (error) {
      console.error('❌ CONNECTION ERROR:', error.message);
      console.error('Stack:', error.stack);
      console.log('=====================================\n');

      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect(true);
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket) {
    console.log('\n=== SOCKET DISCONNECTION ===');
    console.log('Client ID:', client.id);

    const userId = client.data.userId;
    const userType = client.data.userType;

    console.log('User ID:', userId);
    console.log('User Type:', userType);

    if (userId && userType) {
      const userKey = `${userId}:${userType}`;

      // Clear heartbeat
      this.clearHeartbeat(userKey);

      // Only remove if this is the current socket (not replaced)
      const currentSocket = this.userSockets.get(userKey);
      if (currentSocket?.id === client.id) {
        this.userSockets.delete(userKey);

        console.log('✅ User removed from active connections');

        // Notify user is offline
        client.broadcast.emit('user:offline', {
          userId,
          userType,
        });

        console.log('Broadcasting user:offline event');
      } else {
        console.log('⚠️  Socket was already replaced, not removing');
      }

      // Log connection duration
      const duration = Date.now() - (client.data.connectedAt || Date.now());
      console.log('Connection Duration:', Math.round(duration / 1000), 'seconds');
      console.log('Remaining Connected Users:', this.userSockets.size);

      this.logger.log(
        `Client disconnected: ${client.id} (User: ${userId}, Duration: ${Math.round(duration / 1000)}s)`,
      );
    } else {
      console.log('⚠️  No user data found for this socket');
      this.logger.log(`Client disconnected: ${client.id}`);
    }

    console.log('============================\n');
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
      console.log('\n📨 === INCOMING MESSAGE ===');
      console.log('From Socket:', client.id);
      console.log('Message DTO:', JSON.stringify(dto, null, 2));

      const userId = client.data.userId;
      const userType = client.data.userType;

      console.log('Sender:', userId, '(' + userType + ')');

      if (!userId || !userType) {
        console.error('❌ User not authenticated');
        throw new UnauthorizedException('User not authenticated');
      }

      const userKey = `${userId}:${userType}`;

      // Check rate limit
      if (!this.checkRateLimit(userKey)) {
        console.warn('⚠️  Rate limit exceeded for:', userKey);
        client.emit('message:error', {
          error: 'Rate limit exceeded. Please slow down.',
          tempId: dto['tempId'],
        });
        this.logger.warn(`Rate limit exceeded for ${userKey}`);
        return;
      }

      // Save message using existing chat service
      console.log('💾 Saving message to database...');
      const message = await this.chatService.sendMessage(userId, userType, dto);
      console.log('✅ Message saved:', message.id);

      // Get the actual conversationId from the message (in case it was auto-created)
      const conversationId = message.conversationId;
      console.log('Conversation ID:', conversationId);

      // 🔔 Send push notification to the recipient
      await this.sendPushNotificationToRecipient(
        conversationId,
        userId,
        userType,
        message,
      );

      // Emit to conversation room (both sender and receiver)
      const roomName = `conversation_${conversationId}`;
      console.log('📡 Emitting to room:', roomName);
      this.server.to(roomName).emit('message:new', message);

      // Also send direct notification to the other user if they're not in the room
      console.log('📬 Sending direct notification to recipient...');
      await this.notifyUserDirectlyWithConversation(
        conversationId,
        userId,
        userType,
        message,
      );

      // 🆕 Send conversation update to SENDER as well
      console.log('📤 Sending conversation update to sender...');
      await this.sendConversationUpdateToSender(
        conversationId,
        userId,
        userType,
        client,
      );

      this.logger.log(
        `Message sent by ${userId} (${userType}) in conversation ${conversationId}`,
      );

      // Acknowledge to sender
      console.log('✅ Acknowledging to sender');
      client.emit('message:sent', {
        tempId: dto['tempId'], // Frontend can send tempId for optimistic UI
        message,
      });

      console.log('==========================\n');

    } catch (error) {
      console.error('❌ MESSAGE SEND ERROR:', error.message);
      console.error('Stack:', error.stack);
      console.log('==========================\n');

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

      // Notify conversation room (for read receipts)
      const roomName = `conversation_${dto.conversationId}`;
      this.server.to(roomName).emit('message:read', {
        conversationId: dto.conversationId,
        messageId: dto.messageId,
        readBy: {
          userId,
          userType,
        },
      });

      // Send confirmation to reader
      client.emit('message:read:success', result);

      // Update conversation for the reader (reset unread count)
      const conversation =
        await this.chatService['conversationModel'].findByPk(dto.conversationId);

      if (conversation) {
        const otherParticipant =
          conversation.participant1Type === userType &&
          conversation.participant1Id === userId
            ? {
                type: conversation.participant2Type,
                id: conversation.participant2Id,
              }
            : {
                type: conversation.participant1Type,
                id: conversation.participant1Id,
              };

        const otherPartyDetails = await this.chatService['getParticipantDetails'](
          otherParticipant.type,
          otherParticipant.id,
        );

        // Emit conversation update to reader (unread count is now 0)
        client.emit('conversation:update', {
          id: conversation.id,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageSenderType: conversation.lastMessageSenderType,
          unreadCount: 0, // Just marked as read
          otherParty: otherPartyDetails,
          otherPartyType: otherParticipant.type,
          updatedAt: conversation.updatedAt,
        });
      }
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
  // @SubscribeMessage('ping')
  // handlePing(@ConnectedSocket() client: Socket) {
  //   client.emit('pong', { timestamp: Date.now() });
  // }

  /**
   * Helper: Extract user from token
   * TODO: Implement proper JWT validation
   */
  private extractUserFromToken(
    token: string,
  ): { userId: number; userType: ParticipantType } | null {
    try {
      // Remove 'Bearer ' prefix if present
      const jwtToken = token.replace(/^Bearer\s+/, '');

      // JwtModule.register({ secret: process.env.JWT_SECRET }) already set secret,
      // so no need to pass secret again here
      const payload = this.jwtService.verify(jwtToken) as any;

      if (!payload?.id || !payload?.userType) {
        return null;
      }

      return {
        userId: payload.id,
        userType: payload.userType,
      };
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
  // private setupPingPong(client: Socket, userKey: string) {
  //   client.on('ping', () => {
  //     client.emit('pong', { timestamp: Date.now() });
  //   });

  //   client.on('pong', () => {
  //     this.logger.debug(`Pong received from ${userKey}`);
  //   });
  // }

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

  /**
   * Public method: Emit new message events to WebSocket clients
   * Called by HTTP endpoints to notify connected users
   */
  public async emitNewMessage(
    conversationId: number,
    senderId: number,
    senderType: ParticipantType,
    message: any,
  ) {
    try {
      console.log('\n📡 === EMITTING MESSAGE VIA HTTP ===');
      console.log('Conversation ID:', conversationId);
      console.log('Sender:', senderId, '(' + senderType + ')');
      console.log('Message ID:', message.id);

      // Emit to conversation room (both sender and receiver if they're in the room)
      const roomName = `conversation_${conversationId}`;
      console.log('📡 Emitting to room:', roomName);
      this.server.to(roomName).emit('message:new', message);

      // Also send direct notification to the other user if they're not in the room
      console.log('📬 Sending direct notification to recipient...');
      await this.notifyUserDirectlyWithConversation(
        conversationId,
        senderId,
        senderType,
        message,
      );

      // 🔔 Send push notification to the recipient
      await this.sendPushNotificationToRecipient(
        conversationId,
        senderId,
        senderType,
        message,
      );

      console.log('✅ WebSocket events emitted successfully');
      console.log('===================================\n');

      this.logger.log(
        `WebSocket events emitted for message ${message.id} in conversation ${conversationId}`,
      );
    } catch (error) {
      console.error('❌ ERROR EMITTING WEBSOCKET EVENTS:', error.message);
      console.error('Stack:', error.stack);
      console.log('===================================\n');

      this.logger.error(
        `Failed to emit WebSocket events: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Helper: Notify a specific user with conversation update
   * Sends both message notification and conversation list update
   */
  private async notifyUserDirectlyWithConversation(
    conversationId: number,
    senderUserId: number,
    senderUserType: ParticipantType,
    message: any,
  ) {
    try {
      // Get conversation to find the other user
      const conversation =
        await this.chatService['conversationModel'].findByPk(conversationId);

      if (!conversation) return;

      // Determine the recipient
      let recipientUserId: number;
      let recipientUserType: ParticipantType;

      if (
        conversation.participant1Type === senderUserType &&
        conversation.participant1Id === senderUserId
      ) {
        recipientUserId = conversation.participant2Id;
        recipientUserType = conversation.participant2Type;
      } else if (
        conversation.participant2Type === senderUserType &&
        conversation.participant2Id === senderUserId
      ) {
        recipientUserId = conversation.participant1Id;
        recipientUserType = conversation.participant1Type;
      } else {
        this.logger.warn(
          `Sender ${senderUserId}:${senderUserType} not in conversation ${conversationId}`,
        );
        return;
      }

      const userKey = `${recipientUserId}:${recipientUserType}`;
      const recipientSocket = this.userSockets.get(userKey);

      if (recipientSocket) {
        // Send message notification
        recipientSocket.emit('message:notification', {
          conversationId,
          message,
        });

        // Get recipient's unread count for this conversation
        const recipientUnreadCount =
          recipientUserType === conversation.participant1Type &&
          recipientUserId === conversation.participant1Id
            ? conversation.unreadCountParticipant1
            : conversation.unreadCountParticipant2;

        // Get sender details for conversation update
        const senderDetails = await this.chatService['getParticipantDetails'](
          senderUserType,
          senderUserId,
        );

        // Get recipient details (currentUser for the frontend)
        const recipientDetails = await this.chatService['getParticipantDetails'](
          recipientUserType,
          recipientUserId,
        );

        // Send conversation update (for conversations list)
        recipientSocket.emit('conversation:update', {
          id: conversationId,
          currentUser: recipientDetails,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageSenderType: conversation.lastMessageSenderType,
          unreadCount: recipientUnreadCount,
          otherParty: senderDetails,
          otherPartyType: senderUserType,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        });

        this.logger.debug(
          `Sent notifications to ${recipientUserId}:${recipientUserType}`,
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
   * Helper: Send conversation update to the sender
   * Updates the sender's conversation list after they send a message
   */
  private async sendConversationUpdateToSender(
    conversationId: number,
    senderUserId: number,
    senderUserType: ParticipantType,
    senderSocket: Socket,
  ) {
    try {
      // Get conversation details
      const conversation =
        await this.chatService['conversationModel'].findByPk(conversationId);

      if (!conversation) return;

      // Determine the other participant (recipient)
      let recipientUserId: number;
      let recipientUserType: ParticipantType;

      if (
        conversation.participant1Type === senderUserType &&
        conversation.participant1Id === senderUserId
      ) {
        // Sender is participant1, so other party is participant2
        recipientUserId = conversation.participant2Id;
        recipientUserType = conversation.participant2Type;
      } else if (
        conversation.participant2Type === senderUserType &&
        conversation.participant2Id === senderUserId
      ) {
        // Sender is participant2, so other party is participant1
        recipientUserId = conversation.participant1Id;
        recipientUserType = conversation.participant1Type;
      } else {
        this.logger.warn(
          `Sender ${senderUserId}:${senderUserType} not in conversation ${conversationId}`,
        );
        return;
      }

      // Get sender's unread count (should be 0 since they just sent the message)
      const senderUnreadCount =
        senderUserType === conversation.participant1Type &&
        senderUserId === conversation.participant1Id
          ? conversation.unreadCountParticipant1
          : conversation.unreadCountParticipant2;

      // Get recipient details for conversation update
      const recipientDetails = await this.chatService['getParticipantDetails'](
        recipientUserType,
        recipientUserId,
      );

      // Get sender details (currentUser for the frontend)
      const senderDetails = await this.chatService['getParticipantDetails'](
        senderUserType,
        senderUserId,
      );

      // Send conversation update to sender
      senderSocket.emit('conversation:update', {
        id: conversationId,
        currentUser: senderDetails,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        lastMessageSenderType: conversation.lastMessageSenderType,
        unreadCount: senderUnreadCount, // Should be 0 for sender
        otherParty: recipientDetails,
        otherPartyType: recipientUserType,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });

      this.logger.debug(
        `Sent conversation update to sender ${senderUserId}:${senderUserType}`,
      );
    } catch (error) {
      this.logger.error(`Sender conversation update error: ${error.message}`);
    }
  }

  /**
   * Helper: Send push notification to the recipient of a message
   * Notifies users who are offline or not connected via WebSocket
   */
  private async sendPushNotificationToRecipient(
    conversationId: number,
    senderUserId: number,
    senderUserType: ParticipantType,
    message: any,
  ) {
    try {
      console.log('\n🔔 === SENDING PUSH NOTIFICATION ===');
      console.log('📨 Message ID:', message.id);
      console.log('📤 Sender:', senderUserId, '(' + senderUserType + ')');

      // Get conversation to find the recipient
      const conversation =
        await this.chatService['conversationModel'].findByPk(conversationId);

      if (!conversation) {
        console.log('⚠️  Conversation not found');
        return;
      }

      console.log('💬 Conversation Details:');
      console.log('   - participant1:', conversation.participant1Id, '(' + conversation.participant1Type + ')');
      console.log('   - participant2:', conversation.participant2Id, '(' + conversation.participant2Type + ')');

      // Determine the recipient
      let recipientUserId: number;
      let recipientUserType: ParticipantType;

      if (
        conversation.participant1Type === senderUserType &&
        conversation.participant1Id === senderUserId
      ) {
        console.log('✅ Sender is participant1, so recipient is participant2');
        recipientUserId = conversation.participant2Id;
        recipientUserType = conversation.participant2Type;
      } else if (
        conversation.participant2Type === senderUserType &&
        conversation.participant2Id === senderUserId
      ) {
        console.log('✅ Sender is participant2, so recipient is participant1');
        recipientUserId = conversation.participant1Id;
        recipientUserType = conversation.participant1Type;
      } else {
        console.log('⚠️  Sender not in conversation');
        console.log('   - Expected sender:', senderUserId, '(' + senderUserType + ')');
        console.log('   - participant1:', conversation.participant1Id, '(' + conversation.participant1Type + ')');
        console.log('   - participant2:', conversation.participant2Id, '(' + conversation.participant2Type + ')');
        return;
      }

      console.log('📬 RECIPIENT IDENTIFIED:', recipientUserId, '(' + recipientUserType + ')');

      // Get sender details
      const senderDetails = await this.chatService['getParticipantDetails'](
        senderUserType,
        senderUserId,
      );

      if (!senderDetails) {
        console.log('⚠️  Sender details not found');
        return;
      }

      // Get sender name for notification
      const senderName =
        senderUserType === ParticipantType.INFLUENCER
          ? senderDetails.name
          : senderDetails.brandName;

      console.log('👤 Sender Name:', senderName);

      // Get recipient's FCM tokens
      const deviceUserType =
        recipientUserType === ParticipantType.INFLUENCER
          ? DeviceUserType.INFLUENCER
          : DeviceUserType.BRAND;

      const fcmTokens = await this.deviceTokenService.getAllUserTokens(
        recipientUserId,
        deviceUserType,
      );

      if (!fcmTokens || fcmTokens.length === 0) {
        console.log('⚠️  No FCM tokens found for recipient');
        return;
      }

      console.log('📱 Found', fcmTokens.length, 'FCM token(s) for recipient');

      // Get recipient's unread count for this conversation
      const recipientUnreadCount =
        recipientUserType === conversation.participant1Type &&
        recipientUserId === conversation.participant1Id
          ? conversation.unreadCountParticipant1
          : conversation.unreadCountParticipant2;

      console.log('💬 Recipient Unread Count:', recipientUnreadCount);

      // Prepare notification content - show unread count instead of message
      const messageWord = recipientUnreadCount === 1 ? 'message' : 'messages';
      const notificationBody = `You have ${recipientUnreadCount} unread ${messageWord}`;

      console.log('💬 Notification Body:', notificationBody);

      // Build deep link URL using sender's influencer ID
      const deepLinkUrl =
        recipientUserType === ParticipantType.INFLUENCER
          ? `app://influencers/chat/${senderUserId}`
          : `app://brands/chat/${senderUserId}`;

      console.log('🔗 Deep Link URL:', deepLinkUrl);

      // Send push notification
      await this.notificationService.sendCustomNotification(
        fcmTokens,
        senderName,
        notificationBody,
        {
          type: 'chat_message',
          action: 'view_chat',
          // Clear fields for navigation - who to chat with
          otherPartyId: senderUserId.toString(), // ID of the person who sent the message
          otherPartyType: senderUserType, // Type of the sender (influencer/brand)
          // Additional context
          conversationId: conversationId.toString(),
          messageId: message.id.toString(),
          senderId: senderUserId.toString(),
          senderType: senderUserType,
          senderName: senderName,
          messageType: message.messageType,
          isEncrypted: message.isEncrypted ? 'true' : 'false',
        },
        {
          priority: 'high',
          androidChannelId: 'chat_messages',
          sound: 'default',
          actionUrl: deepLinkUrl,
        },
      );

      console.log('✅ Push notification sent successfully');
      console.log('===================================\n');

      this.logger.log(
        `Push notification sent to ${recipientUserId}:${recipientUserType} for message ${message.id}`,
      );
    } catch (error) {
      console.error('❌ PUSH NOTIFICATION ERROR:', error.message);
      console.error('Stack:', error.stack);
      console.log('===================================\n');

      this.logger.error(`Push notification error: ${error.message}`, error.stack);
      // Don't throw - notification failure shouldn't break message sending
    }
  }
}
