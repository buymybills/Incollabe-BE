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
import { InAppNotificationService } from './in-app-notification.service';
import { NotificationType, NotificationPriority } from './models/in-app-notification.model';

/**
 * WebSocket Gateway for real-time brand notifications.
 *
 * **Purpose**: Push brand-scoped events to the brand dashboard the moment they happen,
 * without requiring the client to poll REST endpoints.
 *
 * **Namespace**: `/brand-notifications`
 *
 * **Auth**: Pass a valid JWT in `auth.token` (same token used for REST API).
 * The JWT must contain `sub` (userId) and `type === 'brand'` or a `brandId` field.
 *
 * **Rooms**: Each brand is automatically joined to room `brand:<brandId>` on connect.
 * Events are scoped to that room so brands never see each other's data.
 *
 * **Events emitted by server:**
 * - `notification:new_application`   — influencer applied to a campaign
 * - `notification:content_submitted` — influencer submitted content for review
 * - `notification:payment_received`  — payment confirmed / funds added
 * - `notification:payment_failed`    — payment attempt failed
 * - `notification:campaign_update`   — generic campaign status change
 * - `notification:new_order`         — new Instagram DM order placed
 * - `notification:new`               — generic catch-all for any other event
 *
 * **Client usage (React / React Native):**
 * ```typescript
 * import { io } from 'socket.io-client';
 *
 * const socket = io('wss://api.teamcollabkaroo.com/brand-notifications', {
 *   auth: { token: `Bearer ${jwtToken}` },
 *   transports: ['websocket', 'polling'],
 * });
 *
 * socket.on('connected', (data) => console.log('Ready', data));
 * socket.on('notification:new_application', (data) => showToast(data));
 * socket.on('notification:content_submitted', (data) => refreshContent(data));
 * socket.on('notification:payment_received', (data) => refreshWallet(data));
 * ```
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/brand-notifications',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
})
export class BrandNotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BrandNotificationsGateway.name);
  private redisPubClient: Redis | null = null;
  private redisSubClient: Redis | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  onModuleDestroy() {
    this.redisPubClient?.disconnect();
    this.redisSubClient?.disconnect();
  }

  afterInit(server: Server) {
    this.redisPubClient = this.redisService.getClient().duplicate();
    this.redisSubClient = this.redisService.getClient().duplicate();

    // afterInit receives the Namespace (not root Server) in a namespaced gateway.
    const rootServer = (server as any).server ?? server;
    rootServer.adapter(createAdapter(this.redisPubClient, this.redisSubClient));

    this.logger.log('Brand Notifications Gateway initialised with Redis adapter');
  }

  /** Authenticate, then join the brand-scoped room. */
  async handleConnection(client: Socket) {
    try {
      let token: string =
        client.handshake.auth.token || client.handshake.headers.authorization || '';

      if (!token) {
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
      const brandId: number = decoded.brandId || (decoded.type === 'brand' ? userId : null);

      if (!brandId) {
        this.logger.warn(`Client ${client.id} is not a brand — rejecting`);
        client.emit('error', { message: 'Brand account required' });
        client.disconnect();
        return;
      }

      // Store on client.data so WsAuthGuard can read it
      client.data.userId = userId;
      client.data.userType = 'brand';
      client.data.brandId = brandId;

      const room = `brand:${brandId}`;
      await client.join(room);

      this.logger.log(`Client ${client.id} authenticated as brand ${brandId} → joined room ${room}`);

      client.emit('connected', {
        message: 'Connected to brand notifications',
        socketId: client.id,
        brandId,
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

  // ─── Emit helpers (called by other services) ──────────────────────────────

  /**
   * Notify a brand that a new influencer has applied to one of their campaigns.
   */
  emitNewApplication(brandId: number, payload: {
    applicationId: number;
    campaignId: number;
    campaignName: string;
    influencerName: string;
    influencerUsername: string;
    influencerAvatar?: string;
  }) {
    this.persistNotification(brandId, {
      type: NotificationType.NEW_APPLICATION,
      title: 'New Application',
      body: `${payload.influencerName} applied to "${payload.campaignName}"`,
      relatedEntityType: 'campaign_application',
      relatedEntityId: payload.applicationId,
      metadata: payload,
    });
    this.emitToBrand(brandId, 'notification:new_application', payload);
  }

  /**
   * Notify a brand that an influencer submitted content for review.
   */
  emitContentSubmitted(brandId: number, payload: {
    applicationId: number;
    campaignId: number;
    campaignName: string;
    influencerName: string;
    contentType: string;
    contentUrl?: string;
  }) {
    this.persistNotification(brandId, {
      type: NotificationType.CONTENT_SUBMITTED,
      title: 'Content Submitted',
      body: `${payload.influencerName} submitted ${payload.contentType} for "${payload.campaignName}"`,
      relatedEntityType: 'campaign_application',
      relatedEntityId: payload.applicationId,
      metadata: payload,
    });
    this.emitToBrand(brandId, 'notification:content_submitted', payload);
  }

  /**
   * Notify a brand that a payment was confirmed.
   */
  emitPaymentReceived(brandId: number, payload: {
    paymentId: string;
    amount: number;
    currency: string;
    description?: string;
  }) {
    this.persistNotification(brandId, {
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment Received',
      body: payload.description || `Payment of ${payload.currency} ${payload.amount} confirmed`,
      priority: NotificationPriority.HIGH,
      metadata: payload,
    });
    this.emitToBrand(brandId, 'notification:payment_received', payload);
  }

  /**
   * Notify a brand that a payment attempt failed.
   */
  emitPaymentFailed(brandId: number, payload: {
    paymentId?: string;
    amount?: number;
    reason: string;
  }) {
    this.persistNotification(brandId, {
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment Failed',
      body: `Payment failed: ${payload.reason}`,
      priority: NotificationPriority.HIGH,
      metadata: payload,
    });
    this.emitToBrand(brandId, 'notification:payment_failed', payload);
  }

  /**
   * Notify a brand of a generic campaign status change.
   */
  emitCampaignUpdate(brandId: number, payload: {
    campaignId: number;
    campaignName: string;
    status: string;
    message?: string;
  }) {
    this.persistNotification(brandId, {
      type: NotificationType.CAMPAIGN_STATUS_UPDATE,
      title: 'Campaign Update',
      body: payload.message || `${payload.campaignName} status changed to ${payload.status}`,
      relatedEntityType: 'campaign',
      relatedEntityId: payload.campaignId,
      metadata: payload,
    });
    this.emitToBrand(brandId, 'notification:campaign_update', payload);
  }

  /**
   * Notify a brand that a new Instagram DM order has been placed with full
   * customer + shipping address details.
   */
  emitNewOrder(brandId: number, payload: {
    orderId: number;
    productName: string;
    brandName: string;
    size?: string;
    amountInr: number;
    customerName?: string;
    customerPhone?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    paymentShortUrl: string;
  }) {
    this.persistNotification(brandId, {
      type: NotificationType.CUSTOM,
      title: 'New Order',
      body: `${payload.customerName || 'A customer'} ordered ${payload.productName}`,
      relatedEntityType: 'order',
      relatedEntityId: payload.orderId,
      priority: NotificationPriority.HIGH,
      metadata: payload,
    });
    this.emitToBrand(brandId, 'notification:new_order', payload);
  }

  /**
   * Generic emit — use when no specific helper fits.
   */
  emitNotification(brandId: number, type: string, data: Record<string, any>) {
    this.emitToBrand(brandId, 'notification:new', { type, ...data });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private emitToBrand(brandId: number, event: string, payload: Record<string, any>) {
    const room = `brand:${brandId}`;
    const full = { ...payload, brandId, timestamp: new Date().toISOString() };
    this.server.to(room).emit(event, full);
    this.logger.debug(`Emitted "${event}" to room ${room}`);
  }

  /**
   * Persist notification to DB so it survives brand being offline.
   * Errors are swallowed — a DB hiccup must never block the WebSocket emit.
   */
  private persistNotification(
    brandId: number,
    opts: {
      type: NotificationType;
      title: string;
      body: string;
      relatedEntityType?: string;
      relatedEntityId?: number;
      priority?: NotificationPriority;
      metadata?: Record<string, any>;
    },
  ) {
    this.inAppNotificationService
      .createNotification({
        userId: brandId,
        userType: 'brand',
        title: opts.title,
        body: opts.body,
        type: opts.type,
        relatedEntityType: opts.relatedEntityType,
        relatedEntityId: opts.relatedEntityId,
        priority: opts.priority ?? NotificationPriority.NORMAL,
        metadata: opts.metadata,
      })
      .catch((err) =>
        this.logger.error(`Failed to persist notification for brand ${brandId}: ${err.message}`),
      );
  }
}
