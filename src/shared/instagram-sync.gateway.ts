import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

/**
 * WebSocket Gateway for Instagram Sync Progress Updates
 *
 * **Purpose**: Provide real-time progress updates during long-running Instagram sync operations
 *
 * **Why use WebSockets?**
 * - Instagram sync takes 1-2 minutes in background
 * - Polling is inefficient (wastes bandwidth, delays updates)
 * - WebSockets provide instant push notifications
 *
 * **How it works:**
 * 1. Client calls `/instagram/sync-all-media-insights` → gets jobId
 * 2. Client connects to this socket with jobId
 * 3. Background worker emits progress updates via this gateway
 * 4. Client receives real-time updates (0%, 25%, 50%, 75%, 100%)
 * 5. Client refreshes data when complete
 *
 * **Events emitted by server:**
 * - `sync:progress` - Progress updates (0-100%)
 * - `sync:complete` - Sync completed successfully
 * - `sync:error` - Sync failed with error
 *
 * **Mobile app usage:**
 * ```typescript
 * // 1. Start sync
 * const { jobId } = await api.post('/instagram/sync-all-media-insights');
 *
 * // 2. Connect to socket
 * const socket = io('wss://api.teamcollabkaroo.com/instagram-sync', {
 *   auth: { token: 'Bearer <jwt-token>' }
 * });
 *
 * // 3. Subscribe to job updates
 * socket.emit('subscribe', jobId);
 *
 * // 4. Listen for progress
 * socket.on(`sync:${jobId}:progress`, (data) => {
 *   console.log(`Progress: ${data.progress}% - ${data.message}`);
 *   updateProgressBar(data.progress);
 * });
 *
 * // 5. Handle completion
 * socket.on(`sync:${jobId}:complete`, (data) => {
 *   console.log('Sync complete!', data.summary);
 *   showSuccessMessage();
 *   refreshProfile();
 * });
 *
 * // 6. Handle errors
 * socket.on(`sync:${jobId}:error`, (error) => {
 *   console.error('Sync failed:', error.message);
 *   showErrorMessage(error.message);
 * });
 * ```
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/instagram-sync',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
})
export class InstagramSyncGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InstagramSyncGateway.name);
  private redisPubClient: Redis | null = null;
  private redisSubClient: Redis | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  onModuleDestroy() {
    this.redisPubClient?.disconnect();
    this.redisSubClient?.disconnect();
  }

  afterInit(server: Server) {
    this.redisPubClient = this.redisService.getClient().duplicate();
    this.redisSubClient = this.redisService.getClient().duplicate();

    const rootServer = (server as any).server ?? server;
    rootServer.adapter(createAdapter(this.redisPubClient, this.redisSubClient));

    this.logger.log('Instagram Sync WebSocket Gateway initialised with Redis adapter');
  }

  async handleConnection(client: Socket) {
    try {
      let token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      if (token.startsWith('Bearer ')) token = token.slice(7);

      let decoded: any;
      try {
        decoded = this.jwtService.verify(token);
      } catch (err: any) {
        this.logger.warn(`Invalid token for ${client.id}: ${err.message}`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const userId: number = decoded.sub || decoded.id;
      const userType: string = decoded.type || decoded.userType;

      // Store on client.data so WsAuthGuard can read it
      client.data.userId = userId;
      client.data.userType = userType;

      // Join user-scoped room so progress events are only sent to this user
      await client.join(`user:${userId}`);

      this.logger.log(`Client ${client.id} authenticated as ${userType} ${userId}`);

      client.emit('connected', {
        message: 'Connected to Instagram sync updates',
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error(`Connection error for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Emit sync progress update to the specific user who owns the job.
   */
  emitSyncProgress(
    userId: number,
    _userType: string,
    jobId: string,
    progress: number,
    message: string,
  ) {
    const eventName = `sync:${jobId}:progress`;
    const payload = {
      jobId,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`user:${userId}`).emit(eventName, payload);
    this.logger.debug(`Emitted progress ${progress}% for job ${jobId} → user:${userId}`);
  }

  /**
   * Emit sync completion to the specific user who owns the job.
   */
  emitSyncComplete(
    userId: number,
    _userType: string,
    jobId: string,
    summary: any,
  ) {
    const eventName = `sync:${jobId}:complete`;
    const payload = {
      jobId,
      success: true,
      summary,
      message: 'Instagram sync completed successfully',
      timestamp: new Date().toISOString(),
    };

    this.server.to(`user:${userId}`).emit(eventName, payload);
    this.logger.log(`Emitted sync complete for job ${jobId} → user:${userId}`);
  }

  /**
   * Emit sync error to the specific user who owns the job.
   */
  emitSyncError(
    userId: number,
    _userType: string,
    jobId: string,
    error: { message: string; code?: string },
  ) {
    const eventName = `sync:${jobId}:error`;
    const payload = {
      jobId,
      success: false,
      error: {
        message: error.message,
        code: error.code || 'SYNC_ERROR',
      },
      timestamp: new Date().toISOString(),
    };

    this.server.to(`user:${userId}`).emit(eventName, payload);
    this.logger.warn(`Emitted sync error for job ${jobId} → user:${userId}: ${error.message}`);
  }
}
