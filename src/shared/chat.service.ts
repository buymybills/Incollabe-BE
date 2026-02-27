import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Conversation, ParticipantType } from './models/conversation.model';
import { Message, MessageType, SenderType } from './models/message.model';
import { CampaignReview, ReviewerType } from './models/campaign-review.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication, ApplicationStatus } from '../campaign/models/campaign-application.model';
import { Op } from 'sequelize';
import {
  CreateConversationDto,
  SendMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  MarkAsReadDto,
  SubmitReviewDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(Message)
    private messageModel: typeof Message,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(CampaignReview)
    private campaignReviewModel: typeof CampaignReview,
  ) {}

  /**
   * Helper: Normalize participant order to prevent duplicate conversations
   * Always put the "smaller" participant as participant1
   */
  private normalizeParticipants(
    type1: ParticipantType,
    id1: number,
    type2: ParticipantType,
    id2: number,
  ) {
    // Sort by type first, then by ID
    if (type1 < type2 || (type1 === type2 && id1 < id2)) {
      return {
        participant1Type: type1,
        participant1Id: id1,
        participant2Type: type2,
        participant2Id: id2,
      };
    }
    return {
      participant1Type: type2,
      participant1Id: id2,
      participant2Type: type1,
      participant2Id: id1,
    };
  }

  /**
   * Helper: Get participant info (influencer or brand details)
   */
  private async getParticipantDetails(type: ParticipantType, id: number) {
    if (type === ParticipantType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(id, {
        attributes: ['id', 'username', 'name', 'profileImage'],
      });
      return influencer ? influencer.toJSON() : null;
    } else {
      const brand = await this.brandModel.findByPk(id, {
        attributes: ['id', 'username', 'brandName', 'profileImage'],
      });
      return brand ? brand.toJSON() : null;
    }
  }

  /**
   * Helper: Check if user is participant in conversation
   */
  private isParticipant(
    conversation: Conversation,
    userId: number,
    userType: ParticipantType,
  ): boolean {
    return (
      (conversation.participant1Type === userType &&
        conversation.participant1Id === userId) ||
      (conversation.participant2Type === userType &&
        conversation.participant2Id === userId)
    );
  }

  /**
   * Helper: Get other participant in conversation
   */
  private getOtherParticipant(
    conversation: Conversation,
    userId: number,
    userType: ParticipantType,
  ) {
    if (
      conversation.participant1Type === userType &&
      conversation.participant1Id === userId
    ) {
      return {
        type: conversation.participant2Type,
        id: conversation.participant2Id,
      };
    }
    return {
      type: conversation.participant1Type,
      id: conversation.participant1Id,
    };
  }

  /**
   * Helper: Get unread count for current user in a specific conversation
   */
  private getUserUnreadCountForConversation(
    conversation: Conversation,
    userId: number,
    userType: ParticipantType,
  ): number {
    if (
      conversation.participant1Type === userType &&
      conversation.participant1Id === userId
    ) {
      return conversation.unreadCountParticipant1;
    }
    return conversation.unreadCountParticipant2;
  }

  /**
   * Create or get existing conversation between any two users
   */
  async createOrGetConversation(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: CreateConversationDto,
  ) {
    const { otherPartyId, otherPartyType } = dto;

    // Prevent chatting with yourself
    if (userType === otherPartyType && userId === otherPartyId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    const userParticipantType = userType as ParticipantType;
    const otherParticipantType = otherPartyType as ParticipantType;

    // Verify other party exists
    const otherParty = await this.getParticipantDetails(
      otherParticipantType,
      otherPartyId,
    );
    if (!otherParty) {
      throw new NotFoundException(
        `${otherPartyType.charAt(0).toUpperCase() + otherPartyType.slice(1)} not found`,
      );
    }

    // Normalize participant order
    const normalized = this.normalizeParticipants(
      userParticipantType,
      userId,
      otherParticipantType,
      otherPartyId,
    );

    // Check if conversation already exists (check both possible orderings)
    let conversation = await this.conversationModel.findOne({
      where: {
        [Op.or]: [
          {
            // Check normalized order
            participant1Type: normalized.participant1Type,
            participant1Id: normalized.participant1Id,
            participant2Type: normalized.participant2Type,
            participant2Id: normalized.participant2Id,
          },
          {
            // Check reverse order (for conversations created with old logic)
            participant1Type: normalized.participant2Type,
            participant1Id: normalized.participant2Id,
            participant2Type: normalized.participant1Type,
            participant2Id: normalized.participant1Id,
          },
        ],
        isActive: true,
      },
    } as any);

    // Create new conversation if doesn't exist
    if (!conversation) {
      conversation = await this.conversationModel.create({
        ...normalized,
        isActive: true,
        unreadCountParticipant1: 0,
        unreadCountParticipant2: 0,
        // Legacy fields (for backward compatibility)
        influencerId:
          normalized.participant1Type === ParticipantType.INFLUENCER
            ? normalized.participant1Id
            : normalized.participant2Type === ParticipantType.INFLUENCER
              ? normalized.participant2Id
              : null,
        brandId:
          normalized.participant1Type === ParticipantType.BRAND
            ? normalized.participant1Id
            : normalized.participant2Type === ParticipantType.BRAND
              ? normalized.participant2Id
              : null,
        unreadCountInfluencer: 0,
        unreadCountBrand: 0,
      } as any);
    }

    // Get participant details
    const currentUser = await this.getParticipantDetails(
      userParticipantType,
      userId,
    );

    return {
      id: conversation.id,
      currentUser,
      otherParty,
      otherPartyType,
      lastMessage: conversation.lastMessage,
      lastMessageType: conversation.lastMessageType ?? 'text',
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: this.getUserUnreadCountForConversation(
        conversation,
        userId,
        userParticipantType,
      ),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * Get all conversations for a user
   * Supports type='personal' | 'campaign' filter
   */
  /**
   * Helper method to get unread counts for both personal and campaign conversations
   */
  private async getUnreadCounts(
    userId: number,
    userParticipantType: ParticipantType,
  ): Promise<{ personalUnreadCount: number; campaignUnreadCount: number }> {
    // Fetch ALL personal conversations (just for counting)
    const personalConversations = await this.conversationModel.findAll({
      where: {
        [Op.or]: [
          { participant1Type: userParticipantType, participant1Id: userId },
          { participant2Type: userParticipantType, participant2Id: userId },
        ],
        isActive: true,
        conversationType: 'personal',
        lastMessageAt: { [Op.ne]: null } as any,
      },
      attributes: [
        'id',
        'unreadCountParticipant1',
        'unreadCountParticipant2',
        'participant1Type',
        'participant1Id',
      ],
      raw: true,
    });

    // Calculate personal unread count
    const personalUnreadCount = personalConversations.reduce((sum, conv: any) => {
      const unread = this.getUserUnreadCountForConversation(
        conv as any,
        userId,
        userParticipantType,
      );
      return sum + unread;
    }, 0);

    // Fetch ALL campaign conversations (just for counting)
    // Include both active AND closed campaign conversations
    const campaignConversations = await this.conversationModel.findAll({
      where: {
        [Op.or]: [
          { participant1Type: userParticipantType, participant1Id: userId },
          { participant2Type: userParticipantType, participant2Id: userId },
        ],
        // Don't filter by isActive - we want to count unread messages from closed campaigns too
        conversationType: 'campaign',
      },
      attributes: [
        'id',
        'unreadCountParticipant1',
        'unreadCountParticipant2',
        'participant1Type',
        'participant1Id',
      ],
      raw: true,
    });

    // Calculate campaign unread count
    const campaignUnreadCount = campaignConversations.reduce((sum, conv: any) => {
      const unread = this.getUserUnreadCountForConversation(
        conv as any,
        userId,
        userParticipantType,
      );
      return sum + unread;
    }, 0);

    return { personalUnreadCount, campaignUnreadCount };
  }

  async getConversations(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: GetConversationsDto,
  ) {
    const { page = 1, limit = 20, search, type } = dto;
    const offset = (page - 1) * limit;
    const userParticipantType = userType as ParticipantType;

    // Get unread counts for BOTH types (always)
    const { personalUnreadCount, campaignUnreadCount } = await this.getUnreadCounts(
      userId,
      userParticipantType,
    );

    // Campaign conversations: show immediately, no lastMessageAt requirement
    // Personal conversations: only show after first message
    const isCampaignQuery = type === 'campaign';

    const whereClause: any = {
      [Op.and]: [
        {
          [Op.or]: [
            { participant1Type: userParticipantType, participant1Id: userId },
            { participant2Type: userParticipantType, participant2Id: userId },
          ],
        },
        // Only filter by isActive for personal chats; show ALL campaign conversations (including closed ones)
        ...(!isCampaignQuery ? [{ isActive: true }] : []),
        // Filter by conversation type
        ...(type ? [{ conversationType: type }] : [{ conversationType: 'personal' }]),
        // Personal chats require at least one message; campaign chats appear immediately
        ...(!isCampaignQuery ? [{ lastMessageAt: { [Op.ne]: null as any } }] : []),
      ],
    };

    const { rows: conversations, count: total } =
      await this.conversationModel.findAndCountAll({
        where: whereClause,
        order: [
          ['lastMessageAt', 'DESC NULLS LAST'],
          ['createdAt', 'DESC'],
        ],
        limit,
        offset,
      });

    // Format conversations with other party details
    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant = this.getOtherParticipant(
          conv,
          userId,
          userParticipantType,
        );
        const otherPartyDetails = await this.getParticipantDetails(
          otherParticipant.type,
          otherParticipant.id,
        );

        // Apply search filter if provided
        if (search && otherPartyDetails) {
          const searchLower = search.toLowerCase();
          const nameField =
            otherParticipant.type === ParticipantType.BRAND
              ? 'brandName'
              : 'name';
          const name = otherPartyDetails[nameField]?.toLowerCase() || '';
          const username = otherPartyDetails.username?.toLowerCase() || '';

          if (!name.includes(searchLower) && !username.includes(searchLower)) {
            return null;
          }
        }

        const base = {
          id: conv.id,
          otherParty: otherPartyDetails,
          otherPartyType: otherParticipant.type,
          lastMessage: conv.lastMessage,
          lastMessageType: conv.lastMessageType ?? 'text',
          lastMessageAt: conv.lastMessageAt,
          lastMessageSenderType: conv.lastMessageSenderType,
          unreadCount: this.getUserUnreadCountForConversation(
            conv,
            userId,
            userParticipantType,
          ),
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };

        if (isCampaignQuery) {
          return {
            ...base,
            campaignId: conv.campaignId,
            campaignApplicationId: conv.campaignApplicationId,
            isCampaignClosed: conv.isCampaignClosed,
            campaignClosedAt: conv.campaignClosedAt,
          };
        }
        return base;
      }),
    );

    const filteredConversations = formattedConversations.filter(
      (conv) => conv !== null,
    );

    // For campaign type, group by campaignId with campaign name lookup
    if (isCampaignQuery) {
      const campaignConversations = filteredConversations as any[];
      const campaignIds = [
        ...new Set(
          campaignConversations
            .map((c) => c?.campaignId)
            .filter((id) => id != null),
        ),
      ];

      // Fetch campaigns with brand info
      const campaigns = await this.campaignModel.findAll({
        where: { id: { [Op.in]: campaignIds.length ? campaignIds : [0] } },
        attributes: ['id', 'name', 'brandId'],
        include: [
          {
            model: this.brandModel,
            attributes: ['id', 'brandName', 'profileImage'],
          },
        ],
      });

      const grouped: Record<number, any> = {};
      for (const conv of campaignConversations) {
        if (!conv) continue;
        const cId = conv.campaignId ?? 0;
        if (!grouped[cId]) {
          const campaign = campaigns.find((c) => c.id === cId);
          grouped[cId] = {
            campaignId: cId,
            campaignName: campaign?.name ?? null,
            brandImage: (campaign as any)?.brand?.profileImage ?? null,
            totalSelectedInfluencers: 0, // Will be set to actual conversation count after loop
            totalUnreadMessages: 0,
            conversations: [],
          };
        }
        grouped[cId].conversations.push(conv);
        // Accumulate unread count
        grouped[cId].totalUnreadMessages += conv.unreadCount ?? 0;
      }

      // Set totalSelectedInfluencers to the actual number of conversations
      for (const cId in grouped) {
        grouped[cId].totalSelectedInfluencers = grouped[cId].conversations.length;
      }

      // Determine if all conversations in each campaign are closed
      for (const cId in grouped) {
        const allClosed = grouped[cId].conversations.every(
          (conv: any) => conv.isCampaignClosed === true
        );
        grouped[cId].isCampaignClosed = allClosed;
      }

      return {
        type: 'campaign',
        unreadCounts: {
          personal: personalUnreadCount,
          campaign: campaignUnreadCount,
        },
        campaigns: Object.values(grouped),
        pagination: {
          page,
          limit,
          total: search ? filteredConversations.length : total,
          totalPages: Math.ceil(
            (search ? filteredConversations.length : total) / limit,
          ),
        },
      };
    }

    return {
      type: 'personal',
      unreadCounts: {
        personal: personalUnreadCount,
        campaign: campaignUnreadCount,
      },
      conversations: filteredConversations,
      pagination: {
        page,
        limit,
        total: search ? filteredConversations.length : total,
        totalPages: Math.ceil(
          (search ? filteredConversations.length : total) / limit,
        ),
      },
    };
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: SendMessageDto,
  ) {
    const {
      conversationId,
      otherPartyId,
      otherPartyType,
      content,
      messageType = MessageType.TEXT,
      attachmentUrl,
      attachmentName,
      mediaType,
    } = dto;

    const userParticipantType = userType as ParticipantType;

    // If conversationId not provided, create or get conversation
    let conversation: Conversation | null;
    let actualConversationId: number;

    if (conversationId) {
      // Use provided conversationId
      actualConversationId = conversationId;
      conversation = await this.conversationModel.findByPk(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!this.isParticipant(conversation, userId, userParticipantType)) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }
    } else if (otherPartyId && otherPartyType) {
      // Auto-create or get conversation using otherPartyId and otherPartyType
      const conversationResult = await this.createOrGetConversation(
        userId,
        userType,
        { otherPartyId, otherPartyType },
      );
      actualConversationId = conversationResult.id;

      // Fetch the full conversation object
      conversation =
        await this.conversationModel.findByPk(actualConversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      throw new BadRequestException(
        'Either conversationId OR (otherPartyId and otherPartyType) must be provided',
      );
    }

    // Block messaging in closed campaign chats
    if (conversation.isCampaignClosed) {
      throw new ForbiddenException('This campaign chat has been closed');
    }

    // Validate message has content
    if (!content && !attachmentUrl) {
      throw new BadRequestException('Message must have content or attachment');
    }

    // Auto-detect if message is encrypted
    let isEncrypted = false;
    let encryptionVersion = 'v1';

    if (content) {
      try {
        const parsed = JSON.parse(content);
        // Check for new dual-key format: { encryptedKeyForRecipient, encryptedKeyForSender, iv, ciphertext }
        const isDualKey =
          parsed.encryptedKeyForRecipient &&
          parsed.encryptedKeyForSender &&
          parsed.iv &&
          parsed.ciphertext &&
          typeof parsed.encryptedKeyForRecipient === 'string' &&
          typeof parsed.encryptedKeyForSender === 'string' &&
          typeof parsed.iv === 'string' &&
          typeof parsed.ciphertext === 'string';
        // Check for legacy format: { encryptedKey, iv, ciphertext }
        const isLegacy =
          parsed.encryptedKey &&
          parsed.iv &&
          parsed.ciphertext &&
          typeof parsed.encryptedKey === 'string' &&
          typeof parsed.iv === 'string' &&
          typeof parsed.ciphertext === 'string';
        if (isDualKey || isLegacy) {
          isEncrypted = true;
          encryptionVersion = parsed.version || 'v1';
        }
      } catch {
        // Not JSON or invalid structure - treat as plaintext
        isEncrypted = false;
      }
    }

    // Create message
    // For encrypted messages, DO NOT store attachmentUrl/attachmentName in plain text
    // They should be included inside the encrypted content for E2EE security
    const message = await this.messageModel.create({
      conversationId: actualConversationId,
      senderType: userType as SenderType,
      influencerId: userType === 'influencer' ? userId : null,
      brandId: userType === 'brand' ? userId : null,
      messageType,
      content: content || null,
      attachmentUrl: isEncrypted ? null : attachmentUrl || null,
      attachmentName: isEncrypted ? null : attachmentName || null,
      mediaType: isEncrypted ? null : mediaType || null,
      isRead: false,
      isEncrypted,
      encryptionVersion,
    } as any);

    // Update conversation's last message and increment unread count for other participant
    const isParticipant1 =
      conversation.participant1Type === userParticipantType &&
      conversation.participant1Id === userId;

    // Set last message preview
    // Media messages → null; text (plain or encrypted) → store content as-is.
    const lastMessagePreview: string | null = attachmentUrl
      ? null
      : content || null;

    const updateData: any = {
      lastMessage: lastMessagePreview,
      lastMessageAt: new Date(),
      lastMessageSenderType: userType,
      lastMessageType: messageType,
    };

    // Increment unread count for the OTHER participant
    if (isParticipant1) {
      updateData.unreadCountParticipant2 =
        conversation.unreadCountParticipant2 + 1;
      // Legacy
      if (conversation.participant2Type === ParticipantType.BRAND) {
        updateData.unreadCountBrand = conversation.unreadCountBrand + 1;
      } else {
        updateData.unreadCountInfluencer =
          conversation.unreadCountInfluencer + 1;
      }
    } else {
      updateData.unreadCountParticipant1 =
        conversation.unreadCountParticipant1 + 1;
      // Legacy
      if (conversation.participant1Type === ParticipantType.BRAND) {
        updateData.unreadCountBrand = conversation.unreadCountBrand + 1;
      } else {
        updateData.unreadCountInfluencer =
          conversation.unreadCountInfluencer + 1;
      }
    }

    await conversation.update(updateData);

    // Get sender details
    const senderDetails = await this.getParticipantDetails(
      userParticipantType,
      userId,
    );

    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: senderDetails,
      senderType: message.senderType,
      messageType: message.messageType,
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName,
      mediaType: message.mediaType,
      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: GetMessagesDto,
  ) {
    const { conversationId, page = 1, limit = 50, beforeMessageId } = dto;
    const offset = (page - 1) * limit;
    const userParticipantType = userType as ParticipantType;

    // Verify user is participant
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!this.isParticipant(conversation, userId, userParticipantType)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Build where clause
    const whereClause: any = {
      conversationId,
      isDeleted: false,
    };

    if (beforeMessageId) {
      whereClause.id = { [Op.lt]: beforeMessageId };
    }

    const { rows: messages, count: total } =
      await this.messageModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Influencer,
            attributes: ['id', 'username', 'name', 'profileImage'],
            required: false,
          },
          {
            model: Brand,
            attributes: ['id', 'username', 'brandName', 'profileImage'],
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      sender:
        msg.senderType === SenderType.INFLUENCER ? msg.influencer : msg.brand,
      senderType: msg.senderType,
      messageType: msg.messageType,
      content: msg.content,
      attachmentUrl: msg.attachmentUrl,
      attachmentName: msg.attachmentName,
      mediaType: msg.mediaType,
      isRead: msg.isRead,
      readAt: msg.readAt,
      createdAt: msg.createdAt,
    }));

    return {
      messages: formattedMessages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: MarkAsReadDto,
  ) {
    const { conversationId, messageId } = dto;
    const userParticipantType = userType as ParticipantType;

    // Verify user is participant
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!this.isParticipant(conversation, userId, userParticipantType)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Determine other participant's sender type
    const otherParticipant = this.getOtherParticipant(
      conversation,
      userId,
      userParticipantType,
    );
    const otherSenderType =
      otherParticipant.type === ParticipantType.INFLUENCER
        ? SenderType.INFLUENCER
        : SenderType.BRAND;

    // Build where clause for messages to mark as read
    const whereClause: any = {
      conversationId,
      isRead: false,
      senderType: otherSenderType, // Only mark messages from other participant
    };

    if (messageId) {
      whereClause.id = { [Op.lte]: messageId };
    }

    // Mark messages as read
    const [updatedCount] = await this.messageModel.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: whereClause,
      },
    );

    // Reset unread count for this user
    const isParticipant1 =
      conversation.participant1Type === userParticipantType &&
      conversation.participant1Id === userId;

    const updateData: any = {};
    if (isParticipant1) {
      updateData.unreadCountParticipant1 = 0;
      // Legacy
      if (userType === 'influencer') {
        updateData.unreadCountInfluencer = 0;
      } else {
        updateData.unreadCountBrand = 0;
      }
    } else {
      updateData.unreadCountParticipant2 = 0;
      // Legacy
      if (userType === 'influencer') {
        updateData.unreadCountInfluencer = 0;
      } else {
        updateData.unreadCountBrand = 0;
      }
    }

    await conversation.update(updateData);

    return {
      markedCount: updatedCount,
      message: `${updatedCount} message(s) marked as read`,
    };
  }

  /**
   * Get unread message count across all conversations
   */
  async getUnreadCount(userId: number, userType: 'influencer' | 'brand') {
    const userParticipantType = userType as ParticipantType;

    // Only count conversations that have at least one message
    const conversations = await this.conversationModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              {
                participant1Type: userParticipantType,
                participant1Id: userId,
              },
              {
                participant2Type: userParticipantType,
                participant2Id: userId,
              },
            ],
          },
          {
            isActive: true,
          },
          {
            lastMessageAt: { [Op.ne]: null as any }, // Only include conversations with at least one message
          },
        ],
      },
    });

    const totalUnread = conversations.reduce((sum, conv) => {
      return (
        sum +
        this.getUserUnreadCountForConversation(
          conv,
          userId,
          userParticipantType,
        )
      );
    }, 0);

    return {
      totalUnread,
      conversationsWithUnread: conversations.filter(
        (conv) =>
          this.getUserUnreadCountForConversation(
            conv,
            userId,
            userParticipantType,
          ) > 0,
      ).length,
    };
  }

  /**
   * Delete a conversation (soft delete)
   */
  async deleteConversation(
    userId: number,
    userType: 'influencer' | 'brand',
    conversationId: number,
  ) {
    const userParticipantType = userType as ParticipantType;
    const conversation = await this.conversationModel.findByPk(conversationId);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!this.isParticipant(conversation, userId, userParticipantType)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    await conversation.update({ isActive: false });

    return {
      message: 'Conversation deleted successfully',
    };
  }

  // ============================================================
  // Campaign Chat Methods
  // ============================================================

  /**
   * Auto-create a campaign conversation when an influencer is selected.
   * Idempotent — will not create a duplicate if one already exists for this application.
   */
  async createCampaignConversation(
    campaignId: number,
    applicationId: number,
    influencerId: number,
    brandId: number,
  ): Promise<Conversation> {
    // Check idempotency — one conversation per application
    const existing = await this.conversationModel.findOne({
      where: { campaignApplicationId: applicationId },
    });
    if (existing) {
      return existing;
    }

    // Normalize: influencer = participant1, brand = participant2
    const conversation = await this.conversationModel.create({
      conversationType: 'campaign',
      campaignId,
      campaignApplicationId: applicationId,
      participant1Type: ParticipantType.INFLUENCER,
      participant1Id: influencerId,
      participant2Type: ParticipantType.BRAND,
      participant2Id: brandId,
      isActive: true,
      isCampaignClosed: false,
      unreadCountParticipant1: 0,
      unreadCountParticipant2: 0,
      influencerId,
      brandId,
      unreadCountInfluencer: 0,
      unreadCountBrand: 0,
    } as any);

    return conversation;
  }

  /**
   * Brand closes the campaign chat with a specific influencer.
   * Marks conversation as closed and updates the application status to COMPLETED.
   */
  async closeCampaignConversation(
    conversationId: number,
    brandId: number,
  ): Promise<void> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.conversationType !== 'campaign') {
      throw new BadRequestException('This is not a campaign conversation');
    }

    // Validate requester is the brand participant
    const isBrandParticipant =
      (conversation.participant1Type === ParticipantType.BRAND && conversation.participant1Id === brandId) ||
      (conversation.participant2Type === ParticipantType.BRAND && conversation.participant2Id === brandId);

    if (!isBrandParticipant) {
      throw new ForbiddenException('Only the brand can close a campaign chat');
    }

    if (conversation.isCampaignClosed) {
      throw new BadRequestException('This campaign chat is already closed');
    }

    await conversation.update({
      isCampaignClosed: true,
      campaignClosedAt: new Date(),
    });

    // Mark linked application as COMPLETED
    if (conversation.campaignApplicationId) {
      await this.campaignApplicationModel.update(
        { status: ApplicationStatus.COMPLETED },
        { where: { id: conversation.campaignApplicationId } },
      );
    }
  }

  /**
   * Brand bulk-closes all open campaign conversations for a campaign ("Finish Campaign").
   */
  async finishCampaign(
    campaignId: number,
    brandId: number,
  ): Promise<{ closedCount: number }> {
    // Verify brand owns the campaign
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    // Find all open campaign conversations for this campaignId
    const openConversations = await this.conversationModel.findAll({
      where: {
        campaignId,
        isCampaignClosed: false,
        conversationType: 'campaign',
      },
    });

    if (openConversations.length === 0) {
      return { closedCount: 0 };
    }

    const conversationIds = openConversations.map((c) => c.id);
    const applicationIds = openConversations
      .map((c) => c.campaignApplicationId)
      .filter((id): id is number => id != null);

    // Bulk close conversations
    await this.conversationModel.update(
      { isCampaignClosed: true, campaignClosedAt: new Date() },
      { where: { id: { [Op.in]: conversationIds } } },
    );

    // Bulk update linked applications to COMPLETED
    if (applicationIds.length > 0) {
      await this.campaignApplicationModel.update(
        { status: ApplicationStatus.COMPLETED },
        { where: { id: { [Op.in]: applicationIds } } },
      );
    }

    return { closedCount: openConversations.length };
  }

  /**
   * Submit a review after a campaign conversation has been closed.
   * Both brand and influencer can submit one review each.
   */
  async submitCampaignReview(
    conversationId: number,
    reviewerType: 'brand' | 'influencer',
    reviewerId: number,
    dto: SubmitReviewDto,
  ): Promise<CampaignReview> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.conversationType !== 'campaign') {
      throw new BadRequestException('Reviews are only available for campaign conversations');
    }

    if (!conversation.isCampaignClosed) {
      throw new BadRequestException('Reviews can only be submitted after the campaign chat is closed');
    }

    // Validate reviewer is a participant
    const userType = reviewerType as ParticipantType;
    if (!this.isParticipant(conversation, reviewerId, userType)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (!conversation.campaignApplicationId) {
      throw new BadRequestException('No campaign application linked to this conversation');
    }

    // Determine reviewee
    const other = this.getOtherParticipant(conversation, reviewerId, userType);

    // Upsert: one review per side per application
    const [review] = await this.campaignReviewModel.findOrCreate({
      where: {
        campaignApplicationId: conversation.campaignApplicationId,
        reviewerType: reviewerType as ReviewerType,
        reviewerId,
      },
      defaults: {
        campaignId: conversation.campaignId!,
        campaignApplicationId: conversation.campaignApplicationId,
        reviewerType: reviewerType as ReviewerType,
        reviewerId,
        revieweeType: other.type as unknown as ReviewerType,
        revieweeId: other.id,
        rating: dto.rating,
        reviewText: dto.reviewText ?? null,
      },
    });

    // If already existed, update it
    await review.update({
      rating: dto.rating,
      reviewText: dto.reviewText ?? null,
    });

    return review;
  }

  /**
   * Get review status for a campaign conversation (who has reviewed, who hasn't).
   */
  async getCampaignReviewStatus(
    conversationId: number,
    userId: number,
    userType: 'brand' | 'influencer',
  ) {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const participantType = userType as ParticipantType;
    if (!this.isParticipant(conversation, userId, participantType)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (!conversation.campaignApplicationId) {
      return { brandReviewed: false, influencerReviewed: false, myReview: null };
    }

    const reviews = await this.campaignReviewModel.findAll({
      where: { campaignApplicationId: conversation.campaignApplicationId },
    });

    const brandReview = reviews.find((r) => r.reviewerType === ReviewerType.BRAND) ?? null;
    const influencerReview = reviews.find((r) => r.reviewerType === ReviewerType.INFLUENCER) ?? null;
    const myReview = reviews.find((r) => r.reviewerType === (userType as ReviewerType) && r.reviewerId === userId) ?? null;

    return {
      isCampaignClosed: conversation.isCampaignClosed,
      brandReviewed: !!brandReview,
      influencerReviewed: !!influencerReview,
      myReview: myReview ? { rating: myReview.rating, reviewText: myReview.reviewText, createdAt: myReview.createdAt } : null,
    };
  }

  /**
   * E2EE: Set or update user's public key
   */
  async setPublicKey(
    userId: number,
    userType: 'influencer' | 'brand',
    publicKey: string,
  ) {
    const now = new Date();

    switch (userType) {
      case 'influencer': {
        const influencer = await this.influencerModel.findByPk(userId);
        if (!influencer) {
          throw new NotFoundException('Influencer not found');
        }

        const isNewKey = !influencer.publicKey;
        await influencer.update({
          publicKey,
          publicKeyCreatedAt: isNewKey ? now : influencer.publicKeyCreatedAt,
          publicKeyUpdatedAt: now,
        });

        return {
          publicKey: influencer.publicKey,
          publicKeyCreatedAt: influencer.publicKeyCreatedAt,
          publicKeyUpdatedAt: influencer.publicKeyUpdatedAt,
        };
      }
      case 'brand': {
        const brand = await this.brandModel.findByPk(userId);
        if (!brand) {
          throw new NotFoundException('Brand not found');
        }

        const isNewKey = !brand.publicKey;
        await brand.update({
          publicKey,
          publicKeyCreatedAt: isNewKey ? now : brand.publicKeyCreatedAt,
          publicKeyUpdatedAt: now,
        });

        return {
          publicKey: brand.publicKey,
          publicKeyCreatedAt: brand.publicKeyCreatedAt,
          publicKeyUpdatedAt: brand.publicKeyUpdatedAt,
        };
      }
      default:
        throw new BadRequestException('Invalid user type');
    }
  }

  /**
   * E2EE: Get user's public key by identifier (ID or username)
   */
  async getPublicKeyByIdentifier(
    userIdentifier: string,
    userType: 'influencer' | 'brand',
  ) {
    // Try to parse as number first
    const userId = parseInt(userIdentifier, 10);
    const isNumeric = !isNaN(userId) && userId.toString() === userIdentifier;

    if (isNumeric) {
      // Look up by ID
      return this.getPublicKey(userId, userType);
    } else {
      // Look up by username
      return this.getPublicKeyByUsername(userIdentifier, userType);
    }
  }

  /**
   * E2EE: Get user's public key by username
   */
  async getPublicKeyByUsername(
    username: string,
    userType: 'influencer' | 'brand',
  ) {
    switch (userType) {
      case 'influencer': {
        const influencer = await this.influencerModel.findOne({
          where: { username },
          attributes: [
            'id',
            'name',
            'username',
            'publicKey',
            'publicKeyCreatedAt',
            'publicKeyUpdatedAt',
          ],
        });

        if (!influencer) {
          throw new NotFoundException('Influencer not found');
        }

        if (!influencer.publicKey) {
          throw new NotFoundException(
            'This user has not set up end-to-end encryption yet',
          );
        }

        return {
          userId: influencer.id,
          userType: 'influencer',
          name: influencer.name,
          username: influencer.username,
          publicKey: influencer.publicKey,
          publicKeyCreatedAt: influencer.publicKeyCreatedAt,
          publicKeyUpdatedAt: influencer.publicKeyUpdatedAt,
        };
      }
      case 'brand': {
        const brand = await this.brandModel.findOne({
          where: { username },
          attributes: [
            'id',
            'brandName',
            'username',
            'publicKey',
            'publicKeyCreatedAt',
            'publicKeyUpdatedAt',
          ],
        });

        if (!brand) {
          throw new NotFoundException('Brand not found');
        }

        if (!brand.publicKey) {
          throw new NotFoundException(
            'This user has not set up end-to-end encryption yet',
          );
        }

        return {
          userId: brand.id,
          userType: 'brand',
          name: brand.brandName,
          username: brand.username,
          publicKey: brand.publicKey,
          publicKeyCreatedAt: brand.publicKeyCreatedAt,
          publicKeyUpdatedAt: brand.publicKeyUpdatedAt,
        };
      }
      default:
        throw new BadRequestException('Invalid user type');
    }
  }

  /**
   * E2EE: Get user's public key
   */
  async getPublicKey(userId: number, userType: 'influencer' | 'brand') {
    switch (userType) {
      case 'influencer': {
        const influencer = await this.influencerModel.findByPk(userId, {
          attributes: [
            'id',
            'name',
            'username',
            'publicKey',
            'publicKeyCreatedAt',
            'publicKeyUpdatedAt',
          ],
        });

        if (!influencer) {
          throw new NotFoundException('Influencer not found');
        }

        if (!influencer.publicKey) {
          throw new NotFoundException(
            'This user has not set up end-to-end encryption yet',
          );
        }

        return {
          userId: influencer.id,
          userType: 'influencer',
          name: influencer.name,
          username: influencer.username,
          publicKey: influencer.publicKey,
          publicKeyCreatedAt: influencer.publicKeyCreatedAt,
          publicKeyUpdatedAt: influencer.publicKeyUpdatedAt,
        };
      }
      case 'brand': {
        const brand = await this.brandModel.findByPk(userId, {
          attributes: [
            'id',
            'brandName',
            'username',
            'publicKey',
            'publicKeyCreatedAt',
            'publicKeyUpdatedAt',
          ],
        });

        if (!brand) {
          throw new NotFoundException('Brand not found');
        }

        if (!brand.publicKey) {
          throw new NotFoundException(
            'This user has not set up end-to-end encryption yet',
          );
        }

        return {
          userId: brand.id,
          userType: 'brand',
          name: brand.brandName,
          username: brand.username,
          publicKey: brand.publicKey,
          publicKeyCreatedAt: brand.publicKeyCreatedAt,
          publicKeyUpdatedAt: brand.publicKeyUpdatedAt,
        };
      }
      default:
        throw new BadRequestException('Invalid user type');
    }
  }
}
