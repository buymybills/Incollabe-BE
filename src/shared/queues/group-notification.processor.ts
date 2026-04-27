import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Job } from 'bull';
import { GroupChat } from '../models/group-chat.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { NotificationService } from '../notification.service';
import { DeviceTokenService } from '../device-token.service';
import { ChatDecryptionService } from '../services/chat-decryption.service';
import { InAppNotificationService } from '../in-app-notification.service';
import { ParticipantType } from '../models/conversation.model';
import { UserType as DeviceUserType } from '../models/device-token.model';
import { NotificationType } from '../models/in-app-notification.model';
import { MessageType } from '../models/message.model';

export interface GroupPushNotificationJobData {
  groupChatId: number;
  conversationId: number;
  messageId: number;
  messageContent: string | null;
  isEncrypted: boolean;
  messageType: string;
  senderUserId: number;
  senderUserType: string;
  offlineMemberKeys: string[]; // ["memberId:memberType", ...]
}

@Processor('group-notifications')
export class GroupNotificationProcessor {
  private readonly logger = new Logger(GroupNotificationProcessor.name);

  constructor(
    @InjectModel(GroupChat) private readonly groupChatModel: typeof GroupChat,
    @InjectModel(Influencer) private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand) private readonly brandModel: typeof Brand,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly chatDecryptionService: ChatDecryptionService,
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  @Process('group-push-notification')
  async handleGroupPushNotification(job: Job<GroupPushNotificationJobData>) {
    const {
      groupChatId,
      conversationId,
      messageId,
      messageContent,
      isEncrypted,
      messageType,
      senderUserId,
      senderUserType,
      offlineMemberKeys,
    } = job.data;

    this.logger.log(
      `Processing group push for group ${groupChatId}, ${offlineMemberKeys.length} offline members`,
    );

    // Fetch group and sender details ONCE for all recipients
    const group = await this.groupChatModel.findByPk(groupChatId, {
      attributes: ['id', 'name'],
    });
    if (!group) {
      this.logger.warn(`Group ${groupChatId} not found, skipping notifications`);
      return;
    }

    let senderName: string;
    if (senderUserType === ParticipantType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(senderUserId, {
        attributes: ['name'],
      });
      senderName = influencer?.name ?? 'Someone';
    } else {
      const brand = await this.brandModel.findByPk(senderUserId, {
        attributes: ['brandName'],
      });
      senderName = (brand as any)?.brandName ?? 'Someone';
    }

    const notificationTitle = `${senderName} in ${group.name}`;

    // For group messages, encryptedKeys are stored in message_encrypted_keys table,
    // not embedded in content — so decryption in buildNotificationBody will gracefully
    // fall back to a generic string. Body is effectively the same for all recipients.
    const notificationBody = await this.chatDecryptionService.buildNotificationBody(
      { content: messageContent, messageType: messageType as MessageType, isEncrypted },
      0,
      senderUserType as 'influencer' | 'brand',
    );

    // Process in parallel chunks of 50 to avoid overwhelming FCM
    const CHUNK_SIZE = 50;
    for (let i = 0; i < offlineMemberKeys.length; i += CHUNK_SIZE) {
      const chunk = offlineMemberKeys.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((memberKey) =>
          this.notifyMember(
            memberKey,
            groupChatId,
            conversationId,
            messageId,
            notificationTitle,
            notificationBody,
            senderUserId,
            senderUserType,
            senderName,
            group.name,
            messageType,
            isEncrypted,
          ),
        ),
      );
      await job.progress(Math.round(((i + CHUNK_SIZE) / offlineMemberKeys.length) * 100));
    }

    this.logger.log(`Group push notification complete for group ${groupChatId}`);
  }

  private async notifyMember(
    memberKey: string,
    groupChatId: number,
    conversationId: number,
    messageId: number,
    notificationTitle: string,
    notificationBody: string,
    senderUserId: number,
    senderUserType: string,
    senderName: string,
    groupName: string,
    messageType: string,
    isEncrypted: boolean,
  ) {
    try {
      const [memberId, memberType] = memberKey.split(':');
      const recipientId = parseInt(memberId, 10);
      const recipientType = memberType;

      const deviceUserType =
        recipientType === ParticipantType.INFLUENCER
          ? DeviceUserType.INFLUENCER
          : DeviceUserType.BRAND;

      const fcmTokens = await this.deviceTokenService.getAllUserTokens(
        recipientId,
        deviceUserType,
      );
      if (!fcmTokens || fcmTokens.length === 0) return;

      const deepLinkUrl =
        recipientType === ParticipantType.INFLUENCER
          ? `app://influencers/group-chat/${groupChatId}`
          : `app://brands/group-chat/${groupChatId}`;

      await this.notificationService.sendCustomNotification(
        fcmTokens,
        notificationTitle,
        notificationBody,
        {
          type: 'group_chat_message',
          action: 'view_group_chat',
          groupChatId: groupChatId.toString(),
          conversationId: conversationId.toString(),
          messageId: messageId.toString(),
          senderId: senderUserId.toString(),
          senderType: senderUserType,
          senderName,
          groupName,
          messageType,
          isEncrypted: isEncrypted ? 'true' : 'false',
        },
        {
          priority: 'high',
          androidChannelId: 'chat_messages',
          sound: 'default',
          actionUrl: deepLinkUrl,
        },
      );

      this.inAppNotificationService
        .createNotification({
          userId: recipientId,
          userType: recipientType === ParticipantType.INFLUENCER ? 'influencer' : 'brand',
          title: notificationTitle,
          body: notificationBody,
          type: NotificationType.NEW_MESSAGE,
          actionUrl: deepLinkUrl,
          actionType: 'view_group_chat',
          relatedEntityType: 'group_chat',
          relatedEntityId: groupChatId,
          metadata: {
            groupChatId,
            conversationId,
            messageId,
            senderUserId,
            senderUserType,
            senderName,
            groupName,
            messageType,
          },
        } as any)
        .catch((err: any) => {
          this.logger.error(`In-app notification error for ${memberKey}: ${err.message}`);
        });
    } catch (error) {
      this.logger.error(`Failed to notify member ${memberKey}: ${error.message}`);
    }
  }
}
