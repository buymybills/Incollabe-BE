import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiHeader,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from '../shared/chat.service';
import { GroupChatService } from '../shared/group-chat.service';
import { ChatGateway } from '../shared/chat.gateway';
import { S3Service } from '../shared/s3.service';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
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
  GetUploadStatusDto,
} from '../shared/dto/chat.dto';
import {
  CreateGroupDto,
  AddMembersDto,
  RemoveMemberDto,
  UpdateMemberRoleDto,
  UpdateGroupDto,
  GetGroupsDto,
  GetGroupDetailsDto,
} from '../shared/dto/group-chat.dto';

/**
 * External Chat API Controller
 *
 * This controller exposes ALL chat functionality to external backend applications.
 *
 * Authentication Methods:
 * 1. JWT Token (Authorization: Bearer <token>)
 *    - For BRANDS (they exist in local database)
 *    - For INTERNAL INFLUENCERS (they exist in local database)
 *
 * 2. API Key + Headers (x-api-key, x-user-id, x-user-type, etc.)
 *    - For EXTERNAL INFLUENCERS (they don't exist in local database)
 *    - Only allowed for userType = 'influencer'
 *
 * Features:
 * - Personal 1-to-1 conversations
 * - Group chat (create, join, leave, admin)
 * - Send/receive E2EE encrypted messages
 * - File uploads (images, videos, audio, documents)
 * - Chunked uploads for large files
 * - E2EE key management
 * - Campaign conversations (if applicable)
 * - Real-time WebSocket support
 */
@ApiTags('External API - Complete Chat System')
@ApiSecurity('bearer')
@ApiSecurity('api-key')
@ApiHeader({
  name: 'Authorization',
  description: 'JWT Bearer token (for brands and internal influencers)',
  required: false,
  example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
})
@ApiHeader({
  name: 'x-api-key',
  description: 'API key for external influencers (alternative to JWT)',
  required: false,
  example: 'your-secret-api-key',
})
@ApiHeader({
  name: 'x-user-id',
  description: 'User ID (required when using API key)',
  required: false,
  example: '456',
})
@ApiHeader({
  name: 'x-user-type',
  description: 'User type: influencer (required when using API key)',
  required: false,
  example: 'influencer',
})
@ApiHeader({
  name: 'x-app-id',
  description: 'External application identifier (optional)',
  required: false,
  example: 'external-influencer-platform',
})
@ApiHeader({
  name: 'x-user-email',
  description: 'User email (optional, for external influencers)',
  required: false,
})
@ApiHeader({
  name: 'x-user-username',
  description: 'Username (optional, for external influencers)',
  required: false,
})
@Controller('api/external/v1')
@UseGuards(HybridAuthGuard)
export class ExternalChatController {
  // File upload constraints
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
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_CHUNKED_FILE_SIZE = 500 * 1024 * 1024; // 500MB

  constructor(
    private readonly chatService: ChatService,
    private readonly groupChatService: GroupChatService,
    private readonly chatGateway: ChatGateway,
    private readonly s3Service: S3Service,
  ) {}

  // ============================================================
  // PERSONAL CONVERSATIONS
  // ============================================================

  @Post('chat/conversations')
  @ApiOperation({
    summary: 'Create or get 1-to-1 conversation',
    description:
      '**Authentication:**\n' +
      '- Brands: Use JWT (`Authorization: Bearer <token>`)\n' +
      '- External Influencers: Use API key (`x-api-key`, `x-user-id`, `x-user-type` headers)',
  })
  @ApiResponse({ status: 201, description: 'Conversation created or retrieved' })
  async createOrGetConversation(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createOrGetConversation(
      req.user.id,
      req.user.userType,
      dto,
    );
    return conversation;
  }

  @Get('chat/conversations')
  @ApiOperation({
    summary: 'Get all conversations (personal, campaign, or group)',
    description:
      'Query Parameters:\n' +
      '- `type=personal` - Personal 1-to-1 chats\n' +
      '- `type=campaign` - Campaign conversations\n' +
      '- `type=group` - Group chats\n' +
      '- No type parameter - Defaults to personal\n\n' +
      'Returns unread counts for ALL conversation types.',
  })
  @ApiResponse({ status: 200, description: 'Conversations retrieved' })
  async getConversations(
    @Req() req: RequestWithUser,
    @Query() dto: GetConversationsDto,
  ) {
    const result = await this.chatService.getConversations(
      req.user.id,
      req.user.userType,
      dto,
    );
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
    return result;
  }

  @Post('chat/messages')
  @ApiOperation({
    summary: 'Send E2EE encrypted message',
    description:
      '🔒 All messages are End-to-End Encrypted.\n\n' +
      'Supports: text, image, video, audio, file, media\n\n' +
      'Use conversationId OR (otherPartyId + otherPartyType)',
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(@Req() req: RequestWithUser, @Body() dto: SendMessageDto) {
    const message = await this.chatService.sendMessage(
      req.user.id,
      req.user.userType,
      dto,
    );

    // Emit WebSocket event for real-time delivery
    this.chatGateway.emitNewMessage(
      message.conversationId,
      req.user.id,
      req.user.userType,
      message,
    );

    return message;
  }

  @Put('chat/conversations/:id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
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
    return result;
  }

  @Get('chat/unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(@Req() req: RequestWithUser) {
    const result = await this.chatService.getUnreadCount(
      req.user.id,
      req.user.userType,
    );
    return result;
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
    return result;
  }

  // ============================================================
  // FILE UPLOADS
  // ============================================================

  @Post('chat/upload')
  @ApiOperation({
    summary: 'Upload file for chat (images, videos, audio, documents)',
    description: 'Max size: 50MB. For larger files, use chunked upload endpoints.',
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
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    const allAllowedTypes = [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_AUDIO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES,
    ];

    if (!allAllowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: Images, Videos, Audio, Documents',
      );
    }

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

    const fileUrl = await this.s3Service.uploadFileToS3(
      file,
      folder,
      `${req.user.userType}-${req.user.id}${req.user.isExternal ? '-ext' : ''}`,
    );

    return {
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      category,
      uploadedBy: req.user.userType,
      uploadedById: req.user.id,
      isExternal: req.user.isExternal || false,
    };
  }

  @Get('chat/download')
  @ApiOperation({ summary: 'Generate signed URL for downloading chat attachments' })
  @ApiQuery({ name: 'key', description: 'S3 file key/path', required: true })
  @ApiResponse({ status: 200, description: 'Signed URL generated successfully' })
  async downloadFile(@Req() req: RequestWithUser, @Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('File key is required');
    }

    const allowedPrefixes = [
      'chat/images/',
      'chat/videos/',
      'chat/audio/',
      'chat/documents/',
    ];
    const isValidPrefix = allowedPrefixes.some((prefix) =>
      key.startsWith(prefix),
    );

    if (!isValidPrefix) {
      throw new BadRequestException(
        'Invalid file path. Only chat attachments are allowed.',
      );
    }

    const signedUrl = this.s3Service.getSignedUrl(key, 120);

    return {
      signedUrl,
      expiresIn: 120,
    };
  }

  // ============================================================
  // E2EE KEY MANAGEMENT
  // ============================================================

  @Put('e2ee/public-key')
  @ApiOperation({
    summary: 'Set or update public key for E2EE',
    description:
      'Store your RSA-2048 public key for end-to-end encrypted messaging.\n\n' +
      '⚠️ NEVER send your private key to the server!',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['publicKey'],
      properties: {
        publicKey: {
          type: 'string',
          description: 'RSA-2048 public key in Base64-encoded SPKI format',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Public key stored successfully' })
  async setPublicKey(
    @Req() req: RequestWithUser,
    @Body() body: { publicKey: string },
  ) {
    const result = await this.chatService.setPublicKey(
      req.user.id,
      req.user.userType,
      body.publicKey,
    );
    return result;
  }

  @Get('e2ee/public-key/:userType/:userIdentifier')
  @ApiOperation({
    summary: 'Get public key of another user',
    description:
      'Retrieve RSA-2048 public key to encrypt messages.\n' +
      'Use numeric ID or username.',
  })
  @ApiParam({ name: 'userType', enum: ['influencer', 'brand'] })
  @ApiParam({ name: 'userIdentifier', description: 'User ID or username' })
  @ApiResponse({ status: 200, description: 'Public key retrieved successfully' })
  async getPublicKey(
    @Param('userType') userType: 'influencer' | 'brand',
    @Param('userIdentifier') userIdentifier: string,
  ) {
    const result = await this.chatService.getPublicKeyByIdentifier(
      userIdentifier,
      userType,
    );
    return result;
  }

  @Get('e2ee/my-public-key')
  @ApiOperation({ summary: 'Get my own public key' })
  @ApiResponse({ status: 200, description: 'Your public key retrieved successfully' })
  async getMyPublicKey(@Req() req: RequestWithUser) {
    const result = await this.chatService.getPublicKey(
      req.user.id,
      req.user.userType,
    );
    return result;
  }

  @Post('e2ee/public-keys/batch')
  @ApiOperation({
    summary: 'Get public keys for multiple users (for group chat)',
    description: 'Fetch multiple public keys at once for group E2EE encryption.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['users'],
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            required: ['userId', 'userType'],
            properties: {
              userId: { type: 'number' },
              userType: { type: 'string', enum: ['influencer', 'brand'] },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Public keys retrieved successfully' })
  async getBatchPublicKeys(
    @Body()
    body: { users: Array<{ userId: number; userType: 'influencer' | 'brand' }> },
  ) {
    const result = await this.chatService.getBatchPublicKeys(body.users);
    return result;
  }

  @Get('e2ee/conversation/:conversationId/public-keys')
  @ApiOperation({
    summary: 'Get public keys for all participants in a conversation',
    description: 'Simplified endpoint - just pass conversation ID.',
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Public keys retrieved' })
  async getConversationPublicKeys(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    const result = await this.chatService.getConversationPublicKeys(
      conversationId,
      req.user.id,
      req.user.userType,
    );
    return result;
  }

  // ============================================================
  // GROUP CHAT
  // ============================================================

  @Post('groups')
  @ApiOperation({ summary: 'Create a new group chat' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  async createGroup(@Req() req: RequestWithUser, @Body() dto: CreateGroupDto) {
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
  @ApiOperation({ summary: 'Get groups (my groups or all community groups)' })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['my', 'all'],
    description: '"my" for your groups, "all" for all community groups',
  })
  @ApiResponse({ status: 200, description: 'Groups retrieved successfully' })
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
  @ApiOperation({ summary: 'Get group details with members' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search members' })
  @ApiResponse({ status: 200, description: 'Group details retrieved' })
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
  @ApiOperation({ summary: 'Update group details (admin only)' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
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
  @ApiOperation({ summary: 'Add members to group (admin only)' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Members added successfully' })
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
  @ApiOperation({ summary: 'Update member role (promote/demote)' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  async updateMemberRole(
    @Req() req: RequestWithUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateMemberRoleDto,
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
  @ApiOperation({ summary: 'Remove member from group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
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
  @ApiOperation({ summary: 'Join a group (self-join)' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Successfully joined the group' })
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
  @ApiOperation({ summary: 'Leave a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Left group successfully' })
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

  // ============================================================
  // CAMPAIGN CHAT (if applicable)
  // ============================================================

  @Post('chat/campaign-conversations/:id/close')
  @ApiOperation({ summary: 'Close campaign chat (brand only)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Campaign chat closed successfully' })
  async closeCampaignConversation(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can close campaign conversations');
    }
    await this.chatService.closeCampaignConversation(conversationId, req.user.id);
    this.chatGateway.emitCampaignConversationClosed(conversationId, req.user.id);
    return { message: 'Campaign chat closed successfully' };
  }

  @Post('chat/campaigns/:campaignId/finish')
  @ApiOperation({ summary: 'Finish campaign - close all chats (brand only)' })
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
  @ApiOperation({ summary: 'Submit review after campaign chat closes' })
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
  @ApiOperation({ summary: 'Get review status for campaign conversation' })
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

  // ============================================================
  // CHUNKED UPLOADS (for large files up to 500MB)
  // ============================================================

  @Post('upload/multipart/initiate')
  @ApiOperation({
    summary: 'Initiate multipart upload for large files',
    description: 'For files > 50MB, up to 500MB',
  })
  @ApiResponse({ status: 200, description: 'Multipart upload initiated' })
  async initiateMultipartUpload(
    @Req() req: RequestWithUser,
    @Body() dto: InitiateMultipartUploadDto,
  ) {
    if (dto.fileSize > this.MAX_CHUNKED_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum of ${this.MAX_CHUNKED_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    const allAllowedTypes = [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_AUDIO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES,
    ];

    if (!allAllowedTypes.includes(dto.mimeType)) {
      throw new BadRequestException(`File type ${dto.mimeType} is not allowed`);
    }

    const folder = `chat/${dto.fileType}s`;
    const userType = req.user.userType;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = dto.fileName.split('.').pop();
    const key = `${folder}/${userType}-${req.user.id}${req.user.isExternal ? '-ext' : ''}-${uniqueSuffix}.${fileExtension}`;

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
  @ApiOperation({ summary: 'Get presigned URLs for uploading chunks' })
  @ApiResponse({ status: 200, description: 'Presigned URLs generated' })
  async getPresignedUrls(@Body() dto: GetPresignedUrlsDto) {
    const presignedUrls = await this.s3Service.getPresignedUrlsForParts(
      dto.key,
      dto.uploadId,
      dto.parts,
    );
    return { presignedUrls };
  }

  @Post('upload/multipart/complete')
  @ApiOperation({ summary: 'Complete multipart upload' })
  @ApiResponse({ status: 200, description: 'Upload completed successfully' })
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
  @ApiOperation({ summary: 'Abort multipart upload' })
  @ApiResponse({ status: 200, description: 'Upload aborted successfully' })
  async abortMultipartUpload(@Body() dto: AbortMultipartUploadDto) {
    await this.s3Service.abortMultipartUpload(dto.key, dto.uploadId);
    return { message: 'Upload aborted successfully' };
  }

  @Post('upload/multipart/status')
  @ApiOperation({ summary: 'Check multipart upload status' })
  @ApiResponse({ status: 200, description: 'Upload status retrieved' })
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
