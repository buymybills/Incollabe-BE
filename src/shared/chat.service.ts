import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Conversation, ParticipantType } from './models/conversation.model';
import { Message, MessageType, SenderType } from './models/message.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Op } from 'sequelize';
import {
  CreateConversationDto,
  SendMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  MarkAsReadDto,
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
    });

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
   */
  async getConversations(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: GetConversationsDto,
  ) {
    const { page = 1, limit = 20, search } = dto;
    const offset = (page - 1) * limit;
    const userParticipantType = userType as ParticipantType;

    // Find all conversations where user is participant1 or participant2
    const whereClause: any = {
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
      isActive: true,
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
            return null; // Skip this conversation
          }
        }

        return {
          id: conv.id,
          otherParty: otherPartyDetails,
          otherPartyType: otherParticipant.type,
          lastMessage: conv.lastMessage,
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
      }),
    );

    // Filter out null results from search
    const filteredConversations = formattedConversations.filter(
      (conv) => conv !== null,
    );

    return {
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
        // Check if it has E2EE structure
        if (
          parsed.encryptedKey &&
          parsed.iv &&
          parsed.ciphertext &&
          typeof parsed.encryptedKey === 'string' &&
          typeof parsed.iv === 'string' &&
          typeof parsed.ciphertext === 'string'
        ) {
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
      isRead: false,
      isEncrypted,
      encryptionVersion,
    } as any);

    // Update conversation's last message and increment unread count for other participant
    const isParticipant1 =
      conversation.participant1Type === userParticipantType &&
      conversation.participant1Id === userId;

    // Set last message preview
    let lastMessagePreview: string;
    if (isEncrypted) {
      lastMessagePreview = '🔒 Encrypted message';
    } else if (attachmentUrl && !content) {
      lastMessagePreview = `Sent a ${messageType}`;
    } else {
      lastMessagePreview = content || `Sent a ${messageType}`;
    }

    const updateData: any = {
      lastMessage: lastMessagePreview,
      lastMessageAt: new Date(),
      lastMessageSenderType: userType,
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

    const conversations = await this.conversationModel.findAll({
      where: {
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
        isActive: true,
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
