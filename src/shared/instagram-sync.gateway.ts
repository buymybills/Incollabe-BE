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

        console.log(`✅ Client ${client.id} authenticated as ${decoded.type} ${decoded.sub}`);
        this.logger.log(`Client ${client.id} connected and authenticated`);

        // Send connection success event
        client.emit('connected', {
          message: 'Connected to Instagram sync updates',
          socketId: client.id,
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

    // Emit to all authenticated sockets for this user
    this.server.emit(eventName, {
      jobId,
      progress: Math.min(100, Math.max(0, progress)), // Clamp between 0-100
      message,
      timestamp: new Date().toISOString(),
    });
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

    this.server.emit(eventName, {
      jobId,
      success: true,
      summary,
      message: 'Instagram sync completed successfully',
      timestamp: new Date().toISOString(),
    });
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

    this.server.emit(eventName, {
      jobId,
      success: false,
      error: {
        message: error.message,
        code: error.code || 'SYNC_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
