import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

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
    origin: '*', // Configure based on your frontend URL in production
    credentials: true,
  },
  namespace: '/instagram-sync',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
})
export class InstagramSyncGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('InstagramSyncGateway');
  private authenticatedSockets: Map<string, { userId: number; userType: string }> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    console.log('\n🚀 ===== INSTAGRAM SYNC WEBSOCKET GATEWAY INITIALIZED =====');
    console.log('Namespace: /instagram-sync');
    console.log('Purpose: Real-time sync progress updates');
    console.log('==========================================================\n');

    // Configure Redis adapter for cross-process WebSocket communication (OPTIONAL)
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    // Only enable Redis adapter if explicitly configured
    const enableRedisAdapter = process.env.ENABLE_REDIS_ADAPTER === 'true';

    if (enableRedisAdapter) {
      try {
        console.log(`⚙️  Attempting to configure Redis adapter at ${redisHost}:${redisPort}...`);

        // Create Redis pub/sub clients for Socket.IO adapter
        const pubClient = new Redis({
          host: redisHost,
          port: redisPort,
          retryStrategy: (times) => {
            if (times > 3) {
              console.error('❌ Redis connection failed after 3 retries. Disabling Redis adapter.');
              return null; // Stop retrying
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          lazyConnect: true, // Don't connect immediately
        });

        const subClient = pubClient.duplicate({ lazyConnect: true });

        // Handle Redis connection errors
        pubClient.on('error', (error) => {
          console.error('❌ Redis pubClient error:', error.message);
          this.logger.error('Redis pubClient error', error);
        });

        subClient.on('error', (error) => {
          console.error('❌ Redis subClient error:', error.message);
          this.logger.error('Redis subClient error', error);
        });

        // Connect Redis clients
        Promise.all([pubClient.connect(), subClient.connect()])
          .then(() => {
            // Attach Redis adapter to Socket.IO server AFTER successful connection
            server.adapter(createAdapter(pubClient, subClient));
            console.log('✅ Redis adapter configured for multi-process WebSocket support');
            console.log(`   Redis: ${redisHost}:${redisPort}`);
            this.logger.log(`Redis adapter enabled for cross-process communication`);
          })
          .catch((error) => {
            console.error('❌ Failed to connect to Redis:', error.message);
            console.warn('⚠️  WebSocket will work in single-process mode only');
            this.logger.warn('Redis connection failed - using in-memory adapter');
          });
      } catch (error) {
        console.error('❌ Failed to configure Redis adapter:', error);
        console.warn('⚠️  WebSocket will work in single-process mode only');
        this.logger.error('Redis adapter configuration failed', error);
      }
    } else {
      console.log('ℹ️  Redis adapter disabled (set ENABLE_REDIS_ADAPTER=true to enable)');
      console.warn('⚠️  WebSocket will work in single-process mode only');
    }

    this.logger.log('Instagram Sync WebSocket Gateway initialized');
  }

  /**
   * Handle new client connections
   * Validates JWT token and stores authenticated user info
   */
  async handleConnection(client: Socket) {
    try {
      console.log(`\n🔌 New sync gateway connection: ${client.id}`);

      // Extract and verify JWT token
      let token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Strip "Bearer " prefix if present
      if (token.startsWith('Bearer ')) {
        token = token.replace('Bearer ', '');
      }

      // Verify JWT token
      try {
        const decoded = this.jwtService.verify(token);

        // Store authenticated user info
        this.authenticatedSockets.set(client.id, {
          userId: decoded.sub || decoded.id,
          userType: decoded.type || decoded.userType,
        });

        console.log(`✅ Client ${client.id} authenticated as ${decoded.type || decoded.userType} ${decoded.sub || decoded.id}`);
        console.log(`   Total connected clients: ${this.authenticatedSockets.size}`);
        console.log(`   Client IDs in map: [${Array.from(this.authenticatedSockets.keys()).join(', ')}]`);
        this.logger.log(`Client ${client.id} connected and authenticated`);

        // Send connection success event
        client.emit('connected', {
          message: 'Connected to Instagram sync updates',
          socketId: client.id,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`❌ Token verification failed for ${client.id}:`, error.message);
        this.logger.error(`Token verification failed: ${error.message}`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }
    } catch (error) {
      console.error(`❌ Connection error for ${client.id}:`, error);
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
    console.log(`   Remaining clients: ${this.authenticatedSockets.size - 1}`);
    this.logger.log(`Client disconnected: ${client.id}`);
    this.authenticatedSockets.delete(client.id);
  }

  /**
   * Emit sync progress update to specific user
   * Called by background job workers during sync
   *
   * @param _userId - Influencer or brand ID (reserved for future targeted emissions)
   * @param _userType - 'influencer' or 'brand' (reserved for future targeted emissions)
   * @param jobId - Unique job identifier
   * @param progress - Progress percentage (0-100)
   * @param message - Human-readable progress message
   */
  emitSyncProgress(
    _userId: number,
    _userType: string,
    jobId: string,
    progress: number,
    message: string,
  ) {
    const eventName = `sync:${jobId}:progress`;

    console.log(`📡 Emitting progress for job ${jobId}: ${progress}% - ${message}`);
    console.log(`   Event name: ${eventName}`);

    const payload = {
      jobId,
      progress: Math.min(100, Math.max(0, progress)), // Clamp between 0-100
      message,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to ALL clients in the namespace
    // This works across processes if Redis adapter is configured
    this.server.emit(eventName, payload);

    console.log(`   ✅ Event broadcast to namespace (will reach all connected clients across all processes)`);
  }

  /**
   * Emit sync completion notification
   * Called when background sync finishes successfully
   */
  emitSyncComplete(
    _userId: number,
    _userType: string,
    jobId: string,
    summary: any,
  ) {
    const eventName = `sync:${jobId}:complete`;

    console.log(`✅ Emitting completion for job ${jobId}`);

    const payload = {
      jobId,
      success: true,
      summary,
      message: 'Instagram sync completed successfully',
      timestamp: new Date().toISOString(),
    };

    // Broadcast to ALL clients in the namespace
    this.server.emit(eventName, payload);

    console.log(`   ✅ Completion event broadcast to namespace`);
  }

  /**
   * Emit sync error notification
   * Called when background sync fails
   */
  emitSyncError(
    _userId: number,
    _userType: string,
    jobId: string,
    error: { message: string; code?: string },
  ) {
    const eventName = `sync:${jobId}:error`;

    console.log(`❌ Emitting error for job ${jobId}: ${error.message}`);

    const payload = {
      jobId,
      success: false,
      error: {
        message: error.message,
        code: error.code || 'SYNC_ERROR',
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to ALL clients in the namespace
    this.server.emit(eventName, payload);

    console.log(`   ✅ Error event broadcast to namespace`);
  }
}
