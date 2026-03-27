import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { GroupChatService } from './group-chat.service';
import { ChatGateway } from './chat.gateway';
import { S3Service } from './s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { RequestWithUser } from '../types/request.types';
import {
  CreateConversationDto,
  SendMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  MarkAsReadDto,
  MarkAsReadBodyDto,
  SubmitReviewDto,
  InitiateMultipartUploadDto,
  GetPresignedUrlsDto,
  CompleteMultipartUploadDto,
  AbortMultipartUploadDto,
  UpdateUploadProgressDto,
  GetUploadStatusDto,
} from './dto/chat.dto';
import {
  CreateGroupDto,
  AddMembersDto,
  RemoveMemberDto,
  UpdateMemberRoleDto,
  UpdateGroupDto,
  GetGroupsDto,
  GetGroupDetailsDto,
} from './dto/group-chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard)
export class ChatController {
  // Allowed file types and sizes
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
  ];
  private readonly ALLOWED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/m4a',
    'audio/x-m4a',
  ];
  private readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (for standard uploads)
  private readonly MAX_CHUNKED_FILE_SIZE = 500 * 1024 * 1024; // 500MB (for chunked multipart uploads)

  constructor(
    private readonly chatService: ChatService,
    private readonly groupChatService: GroupChatService,
    private readonly chatGateway: ChatGateway,
    private readonly s3Service: S3Service,
  ) {}

  @Post('chat/conversations')
  @ApiOperation({ summary: 'Create or get conversation with another user' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created or retrieved',
  })
  async createOrGetConversation(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createOrGetConversation(
      req.user.id,
      req.user.userType,
      dto,
    );
    return conversation; // Let interceptor wrap it
  }

  @Get('chat/conversations')
  @ApiOperation({
    summary: 'Get all conversations for current user',
    description:
      'Retrieve all conversations (personal, campaign, or group) for the authenticated user.\n\n' +
      '**Query Parameters:**\n' +
      '- `type=personal` - Returns personal one-on-one conversations\n' +
      '- `type=campaign` - Returns campaign conversations grouped by campaign\n' +
      '- `type=group` - Returns group conversations\n' +
      '- No type parameter - Defaults to personal conversations\n\n' +
      '**Response includes:**\n' +
      '- `unreadCounts.personal` - Total unread messages in ALL personal conversations\n' +
      '- `unreadCounts.campaign` - Total unread messages in ALL campaign conversations\n' +
      '- `unreadCounts.group` - Total unread messages in ALL group conversations\n' +
      '- Individual conversation unread counts\n' +
      '- Pagination information\n\n' +
      '💡 **All unread counts are always returned** regardless of which type you query, ' +
      'so you can display badges for all tabs with a single API call!',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    schema: {
      oneOf: [
        {
          // Personal conversations response
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'personal' },
                unreadCounts: {
                  type: 'object',
                  description: 'Unread message counts for BOTH personal and campaign conversations',
                  properties: {
                    personal: {
                      type: 'number',
                      example: 5,
                      description: 'Total unread messages in all personal conversations',
                    },
                    campaign: {
                      type: 'number',
                      example: 8,
                      description: 'Total unread messages in all campaign conversations',
                    },
                    group: {
                      type: 'number',
                      example: 3,
                      description: 'Total unread messages in all group conversations',
                    },
                  },
                },
                conversations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', example: 45 },
                      otherParty: { type: 'object' },
                      otherPartyType: { type: 'string', example: 'brand' },
                      lastMessage: { type: 'string', example: 'Hello!' },
                      lastMessageType: { type: 'string', example: 'text' },
                      lastMessageAt: { type: 'string', example: '2026-02-27T10:00:00.000Z' },
                      lastMessageSenderType: { type: 'string', example: 'brand' },
                      unreadCount: { type: 'number', example: 2 },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 20 },
                    total: { type: 'number', example: 15 },
                    totalPages: { type: 'number', example: 1 },
                  },
                },
              },
            },
          },
        },
        {
          // Campaign conversations response
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'campaign' },
                unreadCounts: {
                  type: 'object',
                  description: 'Unread message counts for BOTH personal and campaign conversations',
                  properties: {
                    personal: {
                      type: 'number',
                      example: 5,
                      description: 'Total unread messages in all personal conversations',
                    },
                    campaign: {
                      type: 'number',
                      example: 8,
                      description: 'Total unread messages in all campaign conversations',
                    },
                    group: {
                      type: 'number',
                      example: 3,
                      description: 'Total unread messages in all group conversations',
                    },
                  },
                },
                campaigns: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      campaignId: { type: 'number', example: 123 },
                      campaignName: { type: 'string', example: 'Summer Campaign 2026' },
                      brandImage: { type: 'string', example: 'https://...' },
                      totalSelectedInfluencers: { type: 'number', example: 5 },
                      totalUnreadMessages: { type: 'number', example: 3 },
                      isCampaignClosed: { type: 'boolean', example: false },
                      conversations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'number', example: 129 },
                            otherParty: { type: 'object' },
                            otherPartyType: { type: 'string', example: 'brand' },
                            lastMessage: { type: 'string' },
                            unreadCount: { type: 'number', example: 1 },
                            campaignId: { type: 'number', example: 123 },
                            campaignApplicationId: { type: 'number', example: 456 },
                            isCampaignClosed: { type: 'boolean', example: false },
                            campaignClosedAt: { type: 'string', nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 20 },
                    total: { type: 'number', example: 10 },
                    totalPages: { type: 'number', example: 1 },
                  },
                },
              },
            },
          },
        },
        {
          // Group conversations response
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'group' },
                unreadCounts: {
                  type: 'object',
                  description: 'Unread message counts for ALL conversation types',
                  properties: {
                    personal: {
                      type: 'number',
                      example: 5,
                      description: 'Total unread messages in all personal conversations',
                    },
                    campaign: {
                      type: 'number',
                      example: 8,
                      description: 'Total unread messages in all campaign conversations',
                    },
                    group: {
                      type: 'number',
                      example: 3,
                      description: 'Total unread messages in all group conversations',
                    },
                  },
                },
                conversations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', example: 78 },
                      conversationType: { type: 'string', example: 'group' },
                      groupChatId: { type: 'number', example: 15 },
                      groupName: { type: 'string', example: 'Team Collaboration' },
                      groupAvatar: { type: 'string', example: 'https://...', nullable: true },
                      memberCount: { type: 'number', example: 5 },
                      lastMessage: { type: 'string', example: 'See you tomorrow!' },
                      lastMessageType: { type: 'string', example: 'text' },
                      lastMessageAt: { type: 'string', example: '2026-03-05T10:00:00.000Z' },
                      lastMessageSenderType: { type: 'string', example: 'influencer' },
                      unreadCount: { type: 'number', example: 2 },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 20 },
                    total: { type: 'number', example: 8 },
                    totalPages: { type: 'number', example: 1 },
                  },
                },
              },
            },
          },
        },
      ],
    },
  })
  async getConversations(
    @Req() req: RequestWithUser,
    @Query() dto: GetConversationsDto,
  ) {
    const result = await this.chatService.getConversations(
      req.user.id,
      req.user.userType,
      dto,
    );
    // Return the result as-is - service handles different structures for personal vs campaign
    return result;
  }

  @Get('chat/conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Messages retrieved' })
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: GetMessagesDto,
  ) {
    const dto: GetMessagesDto = {
      ...query,
      conversationId,
    };
    const result = await this.chatService.getMessages(
      req.user.id,
      req.user.userType,
      dto,
    );
    return result; // Let interceptor wrap it
  }

  @Post('chat/messages')
  @ApiOperation({
    summary: 'Send an E2EE encrypted message',
    description:
      '🔒 **All messages are End-to-End Encrypted (E2EE)**\n\n' +
      'Send encrypted messages using RSA-2048 + AES-256-GCM hybrid encryption.\n\n' +
      '**E2EE Message Flow (1-to-1 Chat):**\n' +
      '1. Generate AES-256 session key on your device\n' +
      '2. Encrypt message content with AES-256-GCM\n' +
      "3. Fetch recipient's public key: GET /api/e2ee/public-key/:userType/:userIdentifier\n" +
      "4. Encrypt AES key with recipient's RSA-2048 public key\n" +
      '5. Send encrypted message using this endpoint\n\n' +
      '**E2EE Message Flow (Group Chat):**\n' +
      '1. Generate AES-256 session key on your device\n' +
      '2. Encrypt message content with AES-256-GCM\n' +
      '3. Fetch all group members: GET /api/groups/:groupId OR POST /api/e2ee/public-keys/batch\n' +
      '4. Encrypt AES key separately with EACH member\'s RSA public key\n' +
      '5. Send message with multi-recipient format (see Group Chat example)\n\n' +
      '**Sending Messages:**\n' +
      '- Option 1: Use `conversationId` if you already have it\n' +
      '- Option 2: Use `otherPartyId` + `otherPartyType` and backend will auto-create/find conversation\n\n' +
      '**Content Format (1-to-1 & Campaign):**\n' +
      'The `content` field must be a JSON string with:\n' +
      '- `encryptedKeyForRecipient`: AES key encrypted for recipient (Base64)\n' +
      '- `encryptedKeyForSender`: AES key encrypted for sender (Base64)\n' +
      '- `iv`: AES-GCM initialization vector (Base64)\n' +
      '- `ciphertext`: AES-256-GCM encrypted message (Base64)\n' +
      '- `version`: Protocol version (currently "v1")\n\n' +
      '**Content Format (Group Chat):**\n' +
      'The `content` field must be a JSON string with:\n' +
      '- `encryptedKeys`: Object mapping "userId:userType" to encrypted AES keys\n' +
      '- `iv`: AES-GCM initialization vector (Base64)\n' +
      '- `ciphertext`: AES-256-GCM encrypted message (Base64)\n' +
      '- `version`: Protocol version (currently "v1")',
  })
  @ApiBody({
    description:
      '🔒 E2EE Encrypted Message Data\n\n' +
      '**Option 1:** Use conversationId if you already have it\n' +
      '**Option 2:** Use otherPartyId + otherPartyType and backend will auto-create/find conversation',
    schema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'number',
          description:
            '(Option 1) Conversation ID - use this if you already have the conversation ID',
          example: 129,
        },
        otherPartyId: {
          type: 'number',
          description:
            '(Option 2) Recipient user ID - backend will find/create conversation automatically',
          example: 32,
        },
        otherPartyType: {
          type: 'string',
          enum: ['influencer', 'brand'],
          description:
            '(Option 2) Recipient user type - required with otherPartyId',
          example: 'brand',
        },
        content: {
          type: 'string',
          description:
            '🔒 E2EE encrypted message as JSON string. Format: {"encryptedKey":"...","iv":"...","ciphertext":"...","version":"v1"}',
          example:
            '{"encryptedKey":"QeGPkee/OBXSmQTHqSUl6acwC1be4HJvwqwdLuCfkfXo...","iv":"oeb3PbPUWVbxZu9g","ciphertext":"MzM7rZE6Zb9LR3Ja8RH/SuO3Ak/53TpYfDMZgyJtRJ4nyi155wCtTazdBBbOoFOuBAjgViD6qhgMB+CZCQsh7n8=","version":"v1"}',
        },
        messageType: {
          type: 'string',
          enum: ['text', 'image', 'video', 'audio', 'file', 'media'],
          description: 'Type of message being sent. Use "media" for mixed/multiple media attachments.',
          default: 'text',
          example: 'text',
        },
        attachmentUrl: {
          type: 'string',
          description:
            '(Optional) Attachment URL for image/video/audio/file messages. Upload files first using POST /api/chat/upload',
          example:
            'https://incollabstaging.s3.ap-south-1.amazonaws.com/chat/images/photo-12345.jpg',
        },
        attachmentName: {
          type: 'string',
          description: '(Optional) Original filename of attachment',
          example: 'vacation-photo.jpg',
        },
        mediaType: {
          type: 'string',
          description:
            '(Optional) MIME type of the media attachment. Use the `fileType` value returned by POST /api/chat/upload',
          example: 'image/jpeg',
        },
      },
      oneOf: [
        {
          required: ['conversationId', 'content', 'messageType'],
          description: 'Option 1: Send using conversation ID (Works for both personal and campaign chats)',
        },
        {
          required: [
            'otherPartyId',
            'otherPartyType',
            'content',
            'messageType',
          ],
          description: 'Option 2: Send using recipient details (ONLY for PERSONAL conversations - will NOT work for campaign chats)',
        },
      ],
    },
    examples: {
      personalChatText: {
        summary: '💬 Personal Chat - Text Message (otherPartyId method)',
        value: {
          otherPartyId: 32,
          otherPartyType: 'brand',
          content:
            '{"encryptedKeyForRecipient":"QeGPkee/OBXSmQTHqSUl6acwC1be4HJvwqwdLuCfkfXoOIO6GJrvZTAgt7oxB1Z6c10aTxNqPxgiQ74buA39gHc5hIrkeGmSQ77COV5UISj9AuErAAkBgHtHg+kBmY6sZ+m2X4GvcHaF7ErGAarrPCF0BmyycWJbHkXW2ldmf8g4FCR2t+RdHICFb9C1jHtbb3kjuZvis3rVv2ewW84ECrnk0DpCp8r9D61wXdruQ3SRPODL/Y7oo6sx3O8zZsn/3YnK34u5lpuZoiH0XWGqAWfQoZGcE9FwMkXfX7OV2sLyymMOJ60akg8m7Ef7uM/KZe1loG1mR65NsgTuFmlu9g==","encryptedKeyForSender":"B8H0sKPJMXxx2pTmjYaD2HD8vbSLbYLOgf4yQsFudUT0rrKeBQK9YSNfHNGILJ2/NQRQPQ...","iv":"oeb3PbPUWVbxZu9g","ciphertext":"MzM7rZE6Zb9LR3Ja8RH/SuO3Ak/53TpYfDMZgyJtRJ4nyi155wCtTazdBBbOoFOuBAjgViD6qhgMB+CZCQsh7n8=","version":"v1"}',
          messageType: 'text',
        },
      },
      personalChatImage: {
        summary: '💬 Personal Chat - Image Message',
        value: {
          otherPartyId: 32,
          otherPartyType: 'brand',
          content:
            '{"encryptedKeyForRecipient":"BfGH2kff/PCYTnRUI...","encryptedKeyForSender":"tV+gb7CRYpC2IldY868q8VpaeFdj5c2P182QO...","iv":"pfC4QcQVWcYZv0Ah","ciphertext":"OzQ8sAF7Ac0MS4Kb9SI+TvP4Bl/64UqZgENAhzKuSK5ozj266xDuUb0eCCcPpGPvCBkhWjE7riHnC/Da...","version":"v1"}',
          messageType: 'image',
          attachmentUrl:
            'https://incollabstaging.s3.ap-south-1.amazonaws.com/chat/images/photo-12345.jpg',
          attachmentName: 'vacation-photo.jpg',
          mediaType: 'image/jpeg',
        },
      },
      campaignChatText: {
        summary: '🎯 Campaign Chat - Text Message (conversationId method)',
        value: {
          conversationId: 129,
          content:
            '{"encryptedKeyForRecipient":"x3ENCEGv0iqVZYfG8WncIRGj3YsUQAORAUow4EK4bwkMm6fVv2xXYDt79OFZiKS9LuLhZSIi7qHmzbXh6JJ555zqLKAq65cMbIhfL9c+40q+3QLWdzr92j6RUxbEaQbNOxycPu4b3sH3vncaCE2olY9PPhkX3hzgQ+nDymQf616hsUyYHttjE5Z6Qgr+i236qE/nt72NVXIfW0PMROFDLTPQsmdySnectGzime6uPrdyefQd+ny7/UheeNcUaawgYWyhKuuTb1SHcWjBbmi0BLd+FdkSaci+dc7Trz5r/cc5MZMHzrMFYSHzki9NIxmA7wHYU4BS23AKnM85/5dj/w==","encryptedKeyForSender":"DZ7GiAbXProuv0tap0zXyuWr3RikndRNmfxZQBl3dhNcRDP...","iv":"veYIthG2b8jam79Q","ciphertext":"ulXhYtP7HA3sSKSygOUUsoVT2uKi","version":"v1"}',
          messageType: 'text',
        },
      },
      campaignChatImage: {
        summary: '🎯 Campaign Chat - Image Message',
        value: {
          conversationId: 129,
          content:
            '{"encryptedKeyForRecipient":"OT6WTujyAl1AwFwQWAXZY/Q/uxHOd6aKoPTL53AB2JvYfsgD067rVzJGCmanGqR74nz4MU...","encryptedKeyForSender":"E382TZB+flwEy/qR+i/ng4OFR+FqkC9j0duCesVimRDTNqCASQgMZHc80mxF/dfW7TtIfrkmA...","iv":"Rc+DNQa603pA8OzY","ciphertext":"qSs9xT0nCM8/juydyrmm44m+0LLJ+luVUhfKb7nRlwkpgLl2dyzcK0ZL4oLYIK5ACeVFFNsutLvLSh4eRpzOl3/fk1O8r3i/0b1RLFEN17gRSyQGyHAZZ8FsK7Bxe4K1IZSST3sUnLQ0dfJ1okFI3w19PnA1z8Ax8FidykvOVPlZMAvFBk83fCNBm2n2X7HXlJegsj0ncCqRR31Q3GyFquJKSBmpIZf4P7EVMC+Dmv7DzI2+inFSaS21KK/xezhC6V/smMsHKlN+HGJCgK+iTxZR1+RRyhTwMQKCp9bQei3lcGxvbWbyDlVz36fId0D+ZSzsp7Dy7uZ4vCwMf/r+","version":"v1"}',
          messageType: 'image',
          attachmentUrl:
            'https://incollabstaging.s3.ap-south-1.amazonaws.com/chat/images/campaign-deliverable.jpg',
          attachmentName: 'deliverable-photo.jpg',
          mediaType: 'image/jpeg',
        },
      },
      personalChatWithConversationId: {
        summary: '💬 Personal Chat - Using Conversation ID (alternative method)',
        value: {
          conversationId: 45,
          content:
            '{"encryptedKeyForRecipient":"QeGPkee/OBXSmQTHqSUl6acwC1be4HJvwqwdLuCfkfXo...","encryptedKeyForSender":"B8H0sKPJMXxx2pTmjYaD2HD8vbSLbYLOgf4yQsFudUT0...","iv":"oeb3PbPUWVbxZu9g","ciphertext":"MzM7rZE6Zb9LR3Ja8RH/SuO3Ak/53TpYfDMZgyJtRJ4nyi155wCtTazdBBbOoFOuBAjgViD6qhgMB+CZCQsh7n8=","version":"v1"}',
          messageType: 'text',
        },
      },
      groupChatText: {
        summary: '👥 Group Chat - E2EE Multi-Recipient Message',
        description:
          'Group chat messages use a multi-recipient encryption format where the AES key is encrypted separately for each member. ' +
          'The encryptedKeys object maps "userId:userType" to the AES key encrypted with that member\'s public key.',
        value: {
          conversationId: 78,
          content:
            '{"encryptedKeys":{"32:influencer":"QeGPkee/OBXSmQTHqSUl6acwC1be4HJvwqwdLuCfkfXo...","15:brand":"x3ENCEGv0iqVZYfG8WncIRGj3YsUQAORAUow4EK4bwk...","18:influencer":"BfGH2kff/PCYTnRUI8e9Zk2pL7mN3qR5sT6uV8wX0yA...","11:influencer":"tV+gb7CRYpC2IldY868q8VpaeFdj5c2P182QOaBcDe..."},"iv":"oeb3PbPUWVbxZu9g","ciphertext":"MzM7rZE6Zb9LR3Ja8RH/SuO3Ak/53TpYfDMZgyJtRJ4nyi155wCtTazdBBbOoFOuBAjgViD6qhgMB+CZCQsh7n8=","version":"v1"}',
          messageType: 'text',
        },
      },
      replyToMessage: {
        summary: '↩️ Reply to Message (WhatsApp-style)',
        description:
          'Reply to a specific message by including replyToMessageId. Works with all conversation types (personal, campaign, group).',
        value: {
          conversationId: 45,
          content:
            '{"encryptedKeyForRecipient":"QeGPkee/OBXSmQTHqSUl6acwC1be4HJvwqwdLuCfkfXo...","encryptedKeyForSender":"B8H0sKPJMXxx2pTmjYaD2HD8vbSLbYLOgf4yQsFudUT0...","iv":"oeb3PbPUWVbxZu9g","ciphertext":"MzM7rZE6Zb9LR3Ja8RH/SuO3Ak/53TpYfDMZgyJtRJ4nyi155wCtTazdBBbOoFOuBAjgViD6qhgMB+CZCQsh7n8=","version":"v1"}',
          messageType: 'text',
          replyToMessageId: 123,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '🔒 E2EE encrypted message sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 123 },
            conversationId: { type: 'number', example: 1 },
            senderId: { type: 'number', example: 11 },
            senderType: { type: 'string', example: 'influencer' },
            content: {
              type: 'string',
              example:
                '{"encryptedKey":"QeGPkee/OBXSmQTH...","iv":"oeb3PbPUWVbxZu9g","ciphertext":"MzM7rZE6Zb9LR3Ja...","version":"v1"}',
              description: 'E2EE encrypted message stored as JSON string',
            },
            messageType: { type: 'string', example: 'text' },
            attachmentUrl: { type: 'string', example: 'https://incollabstaging.s3.ap-south-1.amazonaws.com/chat/images/photo-12345.jpg', nullable: true },
            attachmentName: { type: 'string', example: 'vacation-photo.jpg', nullable: true },
            mediaType: { type: 'string', example: 'image/jpeg', nullable: true, description: 'MIME type of the media attachment' },
            replyToMessageId: { type: 'number', example: 100, nullable: true, description: 'ID of the message being replied to' },
            isEncrypted: {
              type: 'boolean',
              example: true,
              description:
                'Always true for E2EE messages (automatically detected)',
            },
            isRead: { type: 'boolean', example: false },
            createdAt: {
              type: 'string',
              example: '2025-11-17T12:00:00.000Z',
            },
          },
        },
        message: { type: 'string', example: 'Message sent' },
        timestamp: { type: 'string', example: '2025-11-17T12:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Either conversationId OR (otherPartyId + otherPartyType) must be provided. ' +
      'Note: For campaign chats, you MUST use conversationId.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - This campaign chat has been closed (no new messages allowed)',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation or user not found',
  })
  async sendMessage(@Req() req: RequestWithUser, @Body() dto: SendMessageDto) {
    const message = await this.chatService.sendMessage(
      req.user.id,
      req.user.userType,
      dto,
    );

    // Emit WebSocket events to notify connected users in real-time
    this.chatGateway.emitNewMessage(
      message.conversationId,
      req.user.id,
      req.user.userType,
      message,
    );

    return message; // Let interceptor wrap it
  }

  @Put('chat/conversations/:id/read')
  @ApiOperation({
    summary: 'Mark messages as read',
    description:
      'Marks unread messages as read. Leave body empty to mark all unread messages, or provide messageId to mark up to that message.',
  })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: MarkAsReadBodyDto,
  ) {
    const dto: MarkAsReadDto = {
      conversationId,
      messageId: body?.messageId,
    };
    const result = await this.chatService.markAsRead(
      req.user.id,
      req.user.userType,
      dto,
    );
    return result; // Let interceptor wrap it
  }

  @Get('chat/unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(@Req() req: RequestWithUser) {
    const result = await this.chatService.getUnreadCount(
      req.user.id,
      req.user.userType,
    );
    return result; // Let interceptor wrap it
  }

  @Delete('chat/conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async deleteConversation(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    const result = await this.chatService.deleteConversation(
      req.user.id,
      req.user.userType,
      conversationId,
    );
    return result; // Let interceptor wrap it
  }

  @Post('chat/upload')
  @ApiOperation({
    summary: 'Upload file for chat (image, video, audio, or document)',
    description:
      'Upload a file to share in chat. Supports images (JPEG, PNG, GIF, WebP), videos (MP4, MOV, AVI, WebM, MKV), audio (MP3, WAV, WebM, OGG, AAC, M4A), and documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV). Max size: 50MB. For multiple files, upload each separately and use messageType "media" when sending.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example:
                'https://bucket.s3.region.amazonaws.com/chat/file-123456.jpg',
            },
            fileName: { type: 'string', example: 'vacation-photo.jpg' },
            fileSize: { type: 'number', example: 2048576 },
            fileType: { type: 'string', example: 'image/jpeg' },
            uploadedBy: { type: 'string', example: 'influencer' },
            uploadedById: { type: 'number', example: 11 },
          },
        },
        message: { type: 'string', example: 'File uploaded successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Validate file type
    const allAllowedTypes = [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_AUDIO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES,
    ];
    if (!allAllowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MOV, AVI, WebM, MKV), Audio (MP3, WAV, WebM, OGG, AAC, M4A), and Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV)`,
      );
    }

    // Determine file category and folder
    let category: string;
    let folder: string;

    if (this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      category = 'image';
      folder = 'chat/images';
    } else if (this.ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      category = 'video';
      folder = 'chat/videos';
    } else if (this.ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      category = 'audio';
      folder = 'chat/audio';
    } else {
      category = 'document';
      folder = 'chat/documents';
    }

    // Upload to S3
    const fileUrl = await this.s3Service.uploadFileToS3(
      file,
      folder,
      `${req.user.userType}-${req.user.id}`,
    );

    // Let interceptor wrap it
    return {
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      category,
      uploadedBy: req.user.userType,
      uploadedById: req.user.id,
    };
  }

  @Get('chat/download')
  @ApiOperation({
    summary: 'Generate signed URL for chat attachment download',
    description:
      'Generates a temporary signed URL (valid for 2 minutes) for downloading chat attachments securely. ' +
      'Use this endpoint to get a secure download link for images, videos, audio, or documents from chat. ' +
      'The key parameter should be the S3 file path (e.g., "chat/images/brand-32-1773036150127-225588063.png"). ' +
      'Returns a CloudFront CDN URL (if configured) or direct S3 signed URL.',
  })
  @ApiQuery({
    name: 'key',
    description: 'S3 file key/path for the chat attachment',
    example: 'chat/images/brand-32-1773036150127-225588063.png',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            signedUrl: {
              type: 'string',
              example: 'https://cdn.example.com/chat/images/file.png?Policy=xxx&Signature=xxx&Key-Pair-Id=xxx',
              description: 'Temporary signed URL (CloudFront CDN) valid for 2 minutes. Does not expose S3 bucket path.',
            },
            expiresIn: {
              type: 'number',
              example: 120,
              description: 'Time in seconds until the URL expires',
            },
          },
        },
        message: { type: 'string', example: 'Signed URL generated successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or missing file key' })
  @ApiResponse({ status: 403, description: 'Access denied to this file' })
  async downloadFile(
    @Req() req: RequestWithUser,
    @Query('key') key: string,
  ) {
    if (!key) {
      throw new BadRequestException('File key is required');
    }

    // Security: Validate that key starts with allowed chat prefixes
    const allowedPrefixes = ['chat/images/', 'chat/videos/', 'chat/audio/', 'chat/documents/'];
    const isValidPrefix = allowedPrefixes.some(prefix => key.startsWith(prefix));

    if (!isValidPrefix) {
      throw new BadRequestException('Invalid file path. Only chat attachments are allowed.');
    }

    // Generate signed URL (2 minutes expiry)
    const signedUrl = this.s3Service.getSignedUrl(key, 120);

    return {
      signedUrl,
      expiresIn: 120,
    };
  }

  // ================================
  // Campaign Chat Endpoints
  // ================================

  @Post('chat/campaign-conversations/:id/close')
  @ApiOperation({
    summary: 'Close campaign chat with an influencer (brand only)',
    description: 'Brand closes the campaign chat with a specific influencer. Chat is locked for both parties. Application status is set to COMPLETED.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Campaign chat closed successfully' })
  @ApiResponse({ status: 403, description: 'Only the brand can close a campaign chat' })
  async closeCampaignConversation(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can close campaign conversations');
    }
    await this.chatService.closeCampaignConversation(conversationId, req.user.id);

    // Notify both parties via WebSocket
    this.chatGateway.emitCampaignConversationClosed(conversationId, req.user.id);

    return { message: 'Campaign chat closed successfully' };
  }

  @Post('chat/campaigns/:campaignId/finish')
  @ApiOperation({
    summary: 'Finish campaign — close all influencer chats (brand only)',
    description: 'Brand bulk-closes all open campaign conversations for a campaign. All linked applications are set to COMPLETED.',
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign finished successfully' })
  async finishCampaign(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can finish campaigns');
    }
    const result = await this.chatService.finishCampaign(campaignId, req.user.id);
    return result;
  }

  @Post('chat/campaign-conversations/:id/review')
  @ApiOperation({
    summary: 'Submit review after campaign chat is closed',
    description: 'Both brand and influencer can submit one review each after the brand has closed the chat.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Review submitted successfully' })
  async submitCampaignReview(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: SubmitReviewDto,
  ) {
    const review = await this.chatService.submitCampaignReview(
      conversationId,
      req.user.userType,
      req.user.id,
      dto,
    );
    return review;
  }

  @Get('chat/campaign-conversations/:id/review')
  @ApiOperation({ summary: 'Get review status for a campaign conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Review status retrieved' })
  async getCampaignReviewStatus(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    const result = await this.chatService.getCampaignReviewStatus(
      conversationId,
      req.user.id,
      req.user.userType,
    );
    return result;
  }

  // ================================
  // E2EE Key Management Endpoints
  // ================================

  @Put('e2ee/public-key')
  @ApiOperation({
    summary: 'Set or update public key for E2EE',
    description:
      'Store or update your RSA-2048 public key for end-to-end encrypted messaging.\n\n' +
      '⚠️ IMPORTANT: The private key should NEVER be sent to the server. Keep it secure on your device!\n\n' +
      'Steps:\n' +
      '1. Generate RSA-2048 keypair on your device\n' +
      '2. Store private key securely (Keychain/Keystore)\n' +
      '3. Upload ONLY public key to server using this endpoint\n\n' +
      'The public key should be in Base64-encoded SPKI format.',
  })
  @ApiBody({
    description: 'Public key in Base64 format (RSA-2048 SPKI)',
    schema: {
      type: 'object',
      required: ['publicKey'],
      properties: {
        publicKey: {
          type: 'string',
          description: 'RSA-2048 public key in Base64-encoded SPKI format',
          example:
            'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyehkd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdgcKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbcmwIDAQAB',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Public key stored successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            userId: { type: 'number', example: 11 },
            userType: { type: 'string', example: 'influencer' },
            publicKey: {
              type: 'string',
              example: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...',
            },
          },
        },
        message: { type: 'string', example: 'Public key updated successfully' },
        timestamp: {
          type: 'string',
          example: '2025-11-17T12:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid public key format',
  })
  async setPublicKey(
    @Req() req: RequestWithUser,
    @Body() body: { publicKey: string },
  ) {
    const result = await this.chatService.setPublicKey(
      req.user.id,
      req.user.userType,
      body.publicKey,
    );
    return result; // Let interceptor wrap it
  }

  @Get('e2ee/public-key/:userType/:userIdentifier')
  @ApiOperation({
    summary: 'Get public key of another user',
    description:
      'Retrieve the RSA-2048 public key of another user to encrypt messages for them.\n\n' +
      'Required for E2EE messaging workflow:\n' +
      "1. Fetch recipient's public key using this endpoint\n" +
      '2. Encrypt your message with their public key\n' +
      '3. Send encrypted message via POST /api/chat/messages\n\n' +
      'You can use either:\n' +
      '- Numeric user ID (e.g., 32)\n' +
      '- Username (e.g., "johndoe")',
  })
  @ApiParam({
    name: 'userType',
    enum: ['influencer', 'brand'],
    description: 'Type of user whose public key you want to fetch',
    example: 'brand',
  })
  @ApiParam({
    name: 'userIdentifier',
    description: 'User ID (numeric) or username (string) of the recipient',
    example: '32',
  })
  @ApiResponse({
    status: 200,
    description: 'Public key retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            userId: { type: 'number', example: 32 },
            userType: { type: 'string', example: 'brand' },
            username: { type: 'string', example: 'branduser' },
            publicKey: {
              type: 'string',
              example: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...',
            },
          },
        },
        message: { type: 'string', example: 'Public key retrieved' },
        timestamp: {
          type: 'string',
          example: '2025-11-17T12:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found or public key not set',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getPublicKey(
    @Param('userType') userType: 'influencer' | 'brand',
    @Param('userIdentifier') userIdentifier: string,
  ) {
    const result = await this.chatService.getPublicKeyByIdentifier(
      userIdentifier,
      userType,
    );
    return result; // Let interceptor wrap it
  }

  @Get('e2ee/my-public-key')
  @ApiOperation({
    summary: 'Get my own public key',
    description:
      'Retrieve the currently stored RSA-2048 public key for the authenticated user.\n\n' +
      'Useful for:\n' +
      '- Verifying that your public key is stored correctly\n' +
      '- Getting your public key to share with others (outside the app)\n' +
      '- Debugging E2EE setup',
  })
  @ApiResponse({
    status: 200,
    description: 'Your public key retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            userId: { type: 'number', example: 11 },
            userType: { type: 'string', example: 'influencer' },
            publicKey: {
              type: 'string',
              example: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...',
            },
          },
        },
        message: { type: 'string', example: 'Public key retrieved' },
        timestamp: {
          type: 'string',
          example: '2025-11-17T12:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Public key not set - please set it first using PUT /api/e2ee/public-key',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getMyPublicKey(@Req() req: RequestWithUser) {
    const result = await this.chatService.getPublicKey(
      req.user.id,
      req.user.userType,
    );
    return result; // Let interceptor wrap it
  }

  @Post('e2ee/public-keys/batch')
  @ApiOperation({
    summary: 'Get public keys for multiple users (for group chat E2EE)',
    description:
      'Retrieve RSA-2048 public keys for multiple users at once. Required for encrypting group chat messages.\n\n' +
      '**Group Chat E2EE Flow:**\n' +
      '1. Fetch all group members using GET /api/groups/:groupId\n' +
      '2. Use this endpoint to get public keys for all members\n' +
      '3. Generate AES-256 session key\n' +
      '4. Encrypt message with AES-256-GCM\n' +
      '5. Encrypt AES key with each member\'s RSA public key\n' +
      '6. Send message with multi-recipient format\n\n' +
      '**Important:** Users without public keys will have `publicKey: null` in the response. ' +
      'You should handle this gracefully (skip encryption for those users or show a warning).',
  })
  @ApiBody({
    description: 'Array of users to fetch public keys for',
    schema: {
      type: 'object',
      required: ['users'],
      properties: {
        users: {
          type: 'array',
          description: 'List of users to fetch public keys for',
          items: {
            type: 'object',
            required: ['userId', 'userType'],
            properties: {
              userId: {
                type: 'number',
                description: 'User ID',
                example: 32,
              },
              userType: {
                type: 'string',
                enum: ['influencer', 'brand'],
                description: 'User type',
                example: 'influencer',
              },
            },
          },
          example: [
            { userId: 32, userType: 'influencer' },
            { userId: 15, userType: 'brand' },
            { userId: 18, userType: 'influencer' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Public keys retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'number', example: 32 },
              userType: { type: 'string', example: 'influencer' },
              name: { type: 'string', example: 'John Doe' },
              username: { type: 'string', example: 'johndoe' },
              publicKey: {
                type: 'string',
                nullable: true,
                example: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...',
                description: 'Public key in Base64 format, or null if not set',
              },
              publicKeyCreatedAt: {
                type: 'string',
                nullable: true,
                example: '2025-11-15T10:00:00.000Z',
              },
              publicKeyUpdatedAt: {
                type: 'string',
                nullable: true,
                example: '2025-11-15T10:00:00.000Z',
              },
            },
          },
        },
        message: { type: 'string', example: 'Public keys retrieved' },
        timestamp: {
          type: 'string',
          example: '2025-11-17T12:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid user data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getBatchPublicKeys(
    @Body() body: { users: Array<{ userId: number; userType: 'influencer' | 'brand' }> },
  ) {
    const result = await this.chatService.getBatchPublicKeys(body.users);
    return result; // Let interceptor wrap it
  }

  @Get('e2ee/conversation/:conversationId/public-keys')
  @ApiOperation({
    summary: 'Get public keys for all participants in a conversation (simplified)',
    description:
      'Retrieve public keys for all participants in a conversation by just passing the conversation ID.\n\n' +
      '**Simpler Alternative to Batch Endpoint:**\n' +
      'Instead of manually fetching all members and their IDs, just pass the conversation ID and ' +
      'the backend will automatically fetch all participants/members and return their public keys.\n\n' +
      '**Works for:**\n' +
      '- Personal conversations (1-to-1 chats)\n' +
      '- Campaign conversations\n' +
      '- Group conversations (automatically fetches all group members)\n\n' +
      '**Use Case:**\n' +
      'When sending an E2EE message to a conversation, use this endpoint to get all recipient public keys ' +
      'in a single API call without needing to know the participant details.',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    example: 78,
  })
  @ApiResponse({
    status: 200,
    description: 'Public keys for all conversation participants',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            conversationId: { type: 'number', example: 78 },
            conversationType: {
              type: 'string',
              enum: ['personal', 'campaign', 'group'],
              example: 'group',
            },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'number', example: 32 },
                  userType: { type: 'string', example: 'influencer' },
                  name: { type: 'string', example: 'John Doe' },
                  username: { type: 'string', example: 'johndoe' },
                  publicKey: {
                    type: 'string',
                    nullable: true,
                    example: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...',
                    description: 'Public key in Base64 format, or null if not set',
                  },
                  publicKeyCreatedAt: {
                    type: 'string',
                    nullable: true,
                    example: '2025-11-15T10:00:00.000Z',
                  },
                  publicKeyUpdatedAt: {
                    type: 'string',
                    nullable: true,
                    example: '2025-11-15T10:00:00.000Z',
                  },
                },
              },
            },
          },
        },
        message: {
          type: 'string',
          example: 'Public keys retrieved for conversation',
        },
        timestamp: {
          type: 'string',
          example: '2025-11-17T12:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found or user not a participant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getConversationPublicKeys(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    const result = await this.chatService.getConversationPublicKeys(
      conversationId,
      req.user.id,
      req.user.userType,
    );
    return result; // Let interceptor wrap it
  }

  // ============================================================
  // Group Chat Endpoints
  // ============================================================

  @Post('groups')
  @ApiOperation({
    summary: 'Create a new group chat',
    description:
      'Create a new group chat with up to 100 members (including creator). Creator becomes admin.\n\n' +
      '**Group Types:**\n' +
      '- **Regular Group** (`isBroadcastOnly: false`): Any member can send messages (default)\n' +
      '- **Broadcast/Announcement Group** (`isBroadcastOnly: true`): Only admins can send messages\n\n' +
      '**Joining Options:**\n' +
      '- **Joinable** (`isJoinable: true`): Influencers can discover and join the group themselves (default)\n' +
      '- **Invite-Only** (`isJoinable: false`): Only admins can add members\n\n' +
      'Use broadcast mode for announcement channels, newsletters, or community updates where you want to limit who can post.',
  })
  @ApiResponse({
    status: 201,
    description: 'Group created successfully',
  })
  async createGroup(
    @Req() req: RequestWithUser,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupChatService.createGroup(
      req.user.id,
      req.user.userType as any,
      dto.name,
      dto.avatarUrl,
      dto.initialMemberIds,
      dto.isBroadcastOnly,
      dto.isJoinable,
    );
  }

  @Get('groups')
  @ApiOperation({
    summary: 'Get groups (my groups or all community groups)',
    description:
      'Returns groups based on filter parameter:\n\n' +
      '**Filter Options:**\n' +
      '- `filter=my` (default): Returns only groups you are a member of\n' +
      '- `filter=all`: Returns all joinable community groups\n\n' +
      '**When filter=my:**\n' +
      '- Shows only groups you joined\n' +
      '- Always includes `isMember: true`\n' +
      '- Use for "My Groups" tab\n\n' +
      '**When filter=all:**\n' +
      '- Shows ALL joinable community groups\n' +
      '- Includes `isMember` flag (true/false)\n' +
      '- Includes `isFull` flag\n' +
      '- Use for "Discover Groups" tab\n\n' +
      '**Response always includes:**\n' +
      '- `isMember`: Boolean flag (use for "Join" vs "Joined" button)\n' +
      '- `memberCount` and `maxMembers`: Current and maximum counts\n' +
      '- `isFull`: Boolean (only in filter=all)',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['my', 'all'],
    description: 'Filter: "my" for your groups (default), "all" for all community groups',
  })
  @ApiResponse({
    status: 200,
    description: 'Groups retrieved successfully',
    schema: {
      example: {
        groups: [
          {
            id: 1,
            name: 'Marketing Team',
            avatarUrl: 'https://example.com/avatar.png',
            isBroadcastOnly: false,
            memberCount: 5,
            maxMembers: 100,
            isMember: false,
            isFull: false,
            conversation: {
              id: 123,
              conversationType: 'group',
            },
            createdAt: '2026-03-07T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  async getUserGroups(
    @Req() req: RequestWithUser,
    @Query() dto: GetGroupsDto,
  ) {
    return this.groupChatService.getGroups(
      req.user.id,
      req.user.userType,
      dto.filter || 'my',
      dto.page,
      dto.limit,
    );
  }

  @Get('groups/:groupId')
  @ApiOperation({
    summary: 'Get group details with optional influencer search',
    description:
      'Get detailed information about a specific group including members and their public keys.\n\n' +
      '**Group Structure:**\n' +
      '- Brands create and admin community groups\n' +
      '- Influencers join as community members\n\n' +
      '**Influencer Search:** Use the `search` query parameter to filter influencer members by name or username.\n' +
      '- Example: `?search=john` will return only influencers whose name or username contains "john"\n' +
      '- Search is case-insensitive and only applies to influencers (not brand admins)\n' +
      '- Brand admins are always included in results regardless of search\n' +
      '- If no search is provided, all members are returned\n\n' +
      '**E2EE Support:** Member details include `publicKey`, `publicKeyCreatedAt`, and `publicKeyUpdatedAt` fields ' +
      'for implementing end-to-end encryption in group chats. Members without E2EE set up will have `publicKey: null`.\n\n' +
      '**Alternative:** For better performance when you only need public keys, use POST /api/e2ee/public-keys/batch instead.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search influencer members by name or username (case-insensitive). Brand admins are not filtered.',
    example: 'john',
  })
  @ApiResponse({
    status: 200,
    description: 'Group details retrieved successfully',
  })
  async getGroupDetails(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query() dto: GetGroupDetailsDto,
  ) {
    return this.groupChatService.getGroupDetails(
      groupId,
      req.user.id,
      req.user.userType,
      dto.search,
    );
  }

  @Put('groups/:groupId')
  @ApiOperation({
    summary: 'Update group details',
    description: 'Update group name or avatar. Only admins can update group details.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Group updated successfully',
  })
  async updateGroup(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupChatService.updateGroup(
      groupId,
      dto,
      req.user.id,
      req.user.userType,
    );
  }

  @Post('groups/:groupId/members')
  @ApiOperation({
    summary: 'Add members to group',
    description: 'Add new members to an existing group. Only admins can add members.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Members added successfully',
  })
  async addMembers(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: AddMembersDto,
  ) {
    return this.groupChatService.addMembers(
      groupId,
      dto.memberIds,
      dto.memberTypes,
      req.user.id,
      req.user.userType,
    );
  }

  @Patch('groups/:groupId/members/role')
  @ApiOperation({
    summary: 'Update member role (promote/demote)',
    description:
      'Change a member\'s role in the group. Only admins can use this.\n\n' +
      '**Use Cases:**\n' +
      '- Promote a member to admin: Set `role: "admin"`\n' +
      '- Demote an admin to member: Set `role: "member"`\n\n' +
      '**Restrictions:**\n' +
      '- Only group admins can change roles\n' +
      '- Cannot demote the last admin (promote someone else first)\n' +
      '- Before leaving as the last admin, you must promote another member',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: () => require('./dto/group-chat.dto').UpdateMemberRoleDto })
  @ApiResponse({
    status: 200,
    description: 'Member role updated successfully',
    schema: {
      example: {
        success: true,
        groupId: 1,
        memberId: 7,
        memberType: 'influencer',
        newRole: 'admin',
        message: 'Member promoted to admin successfully',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Only admins can change member roles',
  })
  async updateMemberRole(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: any,
  ) {
    return this.groupChatService.updateMemberRole(
      groupId,
      dto.memberId,
      dto.memberType,
      dto.role,
      req.user.id,
      req.user.userType,
    );
  }

  @Delete('groups/:groupId/members')
  @ApiOperation({
    summary: 'Remove a member from group',
    description: 'Remove a member from the group. Admins can remove anyone, members can only remove themselves.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Member removed successfully',
  })
  async removeMember(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: RemoveMemberDto,
  ) {
    return this.groupChatService.removeMember(
      groupId,
      dto.memberId,
      dto.memberType,
      req.user.id,
      req.user.userType,
    );
  }

  @Post('groups/:groupId/join')
  @ApiOperation({
    summary: 'Join a group (self-join)',
    description:
      'Join a group chat yourself without needing an admin invitation. Requirements:\n' +
      '- Group must have `isJoinable: true`\n' +
      '- Group must be active\n' +
      '- Group must not be full (less than maxMembers)\n' +
      '- You must not already be a member\n\n' +
      'This allows influencers to discover groups via GET /api/groups/available and join them independently.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID to join' })
  @ApiResponse({
    status: 200,
    description: 'Successfully joined the group',
    schema: {
      example: {
        success: true,
        message: 'Successfully joined the group',
        groupId: 1,
        conversationId: 123,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Group not joinable, full, or already a member',
  })
  @ApiResponse({
    status: 404,
    description: 'Group not found',
  })
  async joinGroup(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupChatService.joinGroup(
      groupId,
      req.user.id,
      req.user.userType,
    );
  }

  @Post('groups/:groupId/leave')
  @ApiOperation({
    summary: 'Leave a group',
    description: 'Leave a group chat. If you are the last admin, you must promote another member first.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Left group successfully',
  })
  async leaveGroup(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupChatService.leaveGroup(
      groupId,
      req.user.id,
      req.user.userType,
    );
  }

  // ============================================================================
  // Chunked Upload Endpoints (Instagram-style for large files up to 500MB)
  // ============================================================================

  @Post('upload/multipart/initiate')
  @ApiOperation({
    summary: 'Initiate multipart upload for large files',
    description: 'Start a chunked upload session for files larger than 50MB. Returns upload ID and presigned URLs. Supports files up to 500MB.',
  })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload initiated successfully',
    schema: {
      example: {
        uploadId: 'xxxx-xxxx-xxxx',
        key: 'chat/videos/influencer-123-1234567890-abc.mp4',
        fileUrl: 'https://bucket.s3.region.amazonaws.com/chat/videos/...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  async initiateMultipartUpload(
    @Req() req: RequestWithUser,
    @Body() dto: InitiateMultipartUploadDto,
  ) {
    // Validate file size (max 500MB for chunked uploads)
    if (dto.fileSize > this.MAX_CHUNKED_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_CHUNKED_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Validate file type
    const allAllowedTypes = [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_AUDIO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES,
    ];

    if (!allAllowedTypes.includes(dto.mimeType)) {
      throw new BadRequestException(`File type ${dto.mimeType} is not allowed`);
    }

    // Generate S3 key
    const folder = `chat/${dto.fileType}s`;
    const userType = req.user.userType === 'influencer' ? 'influencer' : 'brand';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = dto.fileName.split('.').pop();
    const key = `${folder}/${userType}-${req.user.id}-${uniqueSuffix}.${fileExtension}`;

    // Initiate multipart upload
    const { uploadId } = await this.s3Service.initiateMultipartUpload(
      key,
      dto.mimeType,
    );

    return {
      uploadId,
      key,
      fileUrl: this.s3Service.getFileUrl(key),
    };
  }

  @Post('upload/multipart/presigned-urls')
  @ApiOperation({
    summary: 'Get presigned URLs for uploading chunks',
    description: 'Get presigned URLs for each chunk. Client uploads directly to S3 using these URLs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URLs generated successfully',
    schema: {
      example: {
        presignedUrls: [
          { partNumber: 1, url: 'https://...' },
          { partNumber: 2, url: 'https://...' },
        ],
      },
    },
  })
  async getPresignedUrls(@Body() dto: GetPresignedUrlsDto) {
    const presignedUrls = await this.s3Service.getPresignedUrlsForParts(
      dto.key,
      dto.uploadId,
      dto.parts,
    );

    return { presignedUrls };
  }

  @Post('upload/multipart/complete')
  @ApiOperation({
    summary: 'Complete multipart upload',
    description: 'Finalize the upload by combining all uploaded parts. Returns the final file URL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed successfully',
    schema: {
      example: {
        location: 'https://bucket.s3.region.amazonaws.com/chat/videos/...',
        fileUrl: 'https://bucket.s3.region.amazonaws.com/chat/videos/...',
      },
    },
  })
  async completeMultipartUpload(@Body() dto: CompleteMultipartUploadDto) {
    const result = await this.s3Service.completeMultipartUpload(
      dto.key,
      dto.uploadId,
      dto.parts,
    );

    return {
      location: result.location,
      fileUrl: this.s3Service.getFileUrl(result.key),
    };
  }

  @Post('upload/multipart/abort')
  @ApiOperation({
    summary: 'Abort multipart upload',
    description: 'Cancel an incomplete upload and cleanup S3 resources.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload aborted successfully',
  })
  async abortMultipartUpload(@Body() dto: AbortMultipartUploadDto) {
    await this.s3Service.abortMultipartUpload(dto.key, dto.uploadId);
    return { message: 'Upload aborted successfully' };
  }

  @Post('upload/multipart/status')
  @ApiOperation({
    summary: 'Check multipart upload status',
    description: 'Get list of already uploaded parts. Useful for resuming interrupted uploads.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload status retrieved successfully',
    schema: {
      example: {
        uploadId: 'xxxx-xxxx-xxxx',
        key: 'chat/videos/influencer-123-1234567890-abc.mp4',
        uploadedParts: [
          { PartNumber: 1, ETag: '"etag1"', Size: 5242880 },
          { PartNumber: 2, ETag: '"etag2"', Size: 5242880 },
        ],
        totalPartsUploaded: 2,
      },
    },
  })
  async getUploadStatus(@Body() dto: GetUploadStatusDto) {
    const uploadedParts = await this.s3Service.listUploadedParts(
      dto.key,
      dto.uploadId,
    );

    return {
      uploadId: dto.uploadId,
      key: dto.key,
      uploadedParts,
      totalPartsUploaded: uploadedParts.length,
    };
  }
}
