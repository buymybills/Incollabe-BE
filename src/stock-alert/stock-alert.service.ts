import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from '../auth/model/influencer.model';
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { UserType } from '../shared/models/device-token.model';

export interface StockAlertResult {
  delivered: boolean;
  count?: number;
  reason?: string;
}

/**
 * Resolves an IG shopper (by their messaging igsid == influencer.instagram_user_id)
 * to an app user, and pushes an FCM stock/price alert to their device(s). Returns
 * `delivered:false` (never throws on a miss) so the bot falls back to an IG DM only
 * when the shopper has no app installed / no device token.
 */
@Injectable()
export class StockAlertService {
  private readonly logger = new Logger(StockAlertService.name);

  constructor(
    @InjectModel(Influencer) private readonly influencerModel: typeof Influencer,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
  ) {}

  async push(
    igUserId: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
  ): Promise<StockAlertResult> {
    if (!igUserId) return { delivered: false, reason: 'no igUserId' };

    const influencer = await this.influencerModel.findOne({
      where: { instagramUserId: igUserId },
      attributes: ['id', 'fcmToken'],
    });
    if (!influencer) return { delivered: false, reason: 'no app user for igsid' };

    // Prefer the multi-device DeviceToken store; fall back to the legacy single
    // fcmToken column on the influencer if no device rows exist.
    let tokens = await this.deviceTokenService.getAllUserTokens(influencer.id, UserType.INFLUENCER);
    if ((!tokens || tokens.length === 0) && influencer.fcmToken) {
      tokens = [influencer.fcmToken];
    }
    if (!tokens || tokens.length === 0) {
      return { delivered: false, reason: 'no device token (app not installed)' };
    }

    try {
      await this.notificationService.sendCustomNotification(tokens, title, body, {
        ...data,
        type: 'stock_alert',
      });
      this.logger.log(`stock alert pushed → influencer=${influencer.id} igsid=${igUserId} devices=${tokens.length}`);
      return { delivered: true, count: tokens.length };
    } catch (e) {
      this.logger.error(`stock alert push failed for igsid=${igUserId}: ${e instanceof Error ? e.message : e}`);
      return { delivered: false, reason: 'fcm send failed' };
    }
  }
}
